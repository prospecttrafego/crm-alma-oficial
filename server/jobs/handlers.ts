/**
 * Background Job Handlers
 * Handlers for heavy async tasks: transcription, lead scoring, calendar sync
 */

import { registerJobHandler } from "./queue";
import { logger } from "../logger";
import { storage } from "../storage";
import type { EmailConfig, ParsedEmail } from "../integrations/email";

// ==================== JOB TYPES ====================

export const JobTypes = {
  TRANSCRIBE_AUDIO: "transcribe:audio",
  CALCULATE_LEAD_SCORE: "leadScore:calculate",
  SYNC_GOOGLE_CALENDAR: "googleCalendar:sync",
  SYNC_EMAIL: "email:sync",
  CLEANUP_ORPHAN_FILES: "files:cleanupOrphans",
  CLEANUP_DLQ: "dlq:cleanup",
} as const;

// ==================== PAYLOAD TYPES ====================

export interface TranscribeAudioPayload {
  audioUrl: string;
  language?: string;
  fileId?: number;
  messageId?: number;
}

export interface CalculateLeadScorePayload {
  entityType: "contact" | "deal";
  entityId: number;
  organizationId: number;
}

export interface SyncGoogleCalendarPayload {
  userId: string;
  organizationId: number;
}

export interface SyncEmailPayload {
  channelConfigId: number;
  organizationId: number;
  userId: string;
}

export interface CleanupOrphanFilesPayload {
  dryRun?: boolean;
  limit?: number;
  olderThanDays?: number;
}

export interface CleanupDLQPayload {
  maxAgeMs?: number;
}

// ==================== HANDLERS ====================

/**
 * Transcribe audio in background
 */
async function handleTranscribeAudio(payload: TranscribeAudioPayload): Promise<{
  text: string;
  duration?: number;
}> {
  const { transcribeAudio, isWhisperAvailable } = await import("../integrations/openai/whisper");

  if (!isWhisperAvailable()) {
    throw new Error("Whisper transcription service not available");
  }

  logger.info("[Jobs:Transcribe] Starting transcription", {
    audioUrl: payload.audioUrl.substring(0, 50) + "...",
    fileId: payload.fileId,
  });

  const result = await transcribeAudio(payload.audioUrl, payload.language);

  logger.info("[Jobs:Transcribe] Transcription completed", {
    fileId: payload.fileId,
    textLength: result.text.length,
  });

  return result;
}

/**
 * Calculate lead score in background
 */
async function handleCalculateLeadScore(payload: CalculateLeadScorePayload): Promise<{
  score: number;
  factors: Record<string, number>;
  recommendation: string;
}> {
  const { scoreContact, scoreDeal } = await import("../integrations/openai/scoring");

  logger.info("[Jobs:LeadScore] Starting score calculation", {
    entityType: payload.entityType,
    entityId: payload.entityId,
  });

  let result;

  if (payload.entityType === "contact") {
    const contact = await storage.getContact(payload.entityId);
    if (!contact) {
      throw new Error(`Contact ${payload.entityId} not found`);
    }

    const scoringData = await storage.getContactScoringData(payload.entityId);
    let companyName: string | null = null;
    if (contact.companyId) {
      const company = await storage.getCompany(contact.companyId);
      if (company) companyName = company.name;
    }

    result = await scoreContact(
      {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        jobTitle: contact.jobTitle,
        companyName,
        source: contact.source,
        tags: contact.tags,
      },
      scoringData.activities,
      scoringData.conversations,
      scoringData.deals
    );
  } else {
    const dealData = await storage.getDealScoringData(payload.entityId);
    if (!dealData.deal) {
      throw new Error(`Deal ${payload.entityId} not found`);
    }

    result = await scoreDeal(dealData.deal, dealData.activities, dealData.conversations);
  }

  // Save score to database
  await storage.createLeadScore({
    entityType: payload.entityType,
    entityId: payload.entityId,
    score: result.score,
    factors: result.factors,
    recommendation: result.recommendation,
    nextBestAction: result.nextBestAction,
    organizationId: payload.organizationId,
  });

  logger.info("[Jobs:LeadScore] Score calculated and saved", {
    entityType: payload.entityType,
    entityId: payload.entityId,
    score: result.score,
  });

  return {
    score: result.score,
    factors: result.factors as unknown as Record<string, number>,
    recommendation: result.recommendation,
  };
}

/**
 * Sync Google Calendar in background
 */
async function handleSyncGoogleCalendar(payload: SyncGoogleCalendarPayload): Promise<{
  imported: number;
  updated: number;
  deleted: number;
}> {
  const { googleCalendarService, decryptToken, encryptToken } = await import(
    "../integrations/google/calendar"
  );

  logger.info("[Jobs:GoogleCalendar] Starting sync", { userId: payload.userId });

  const token = await storage.getGoogleOAuthToken(payload.userId);
  if (!token || !token.isActive) {
    throw new Error("Google Calendar not connected");
  }

  // Update sync status
  await storage.updateGoogleOAuthToken(payload.userId, { syncStatus: "syncing", syncError: null });

  try {
    let accessToken = decryptToken(token.accessToken);

    // Refresh if expired
    if (token.expiresAt && new Date(token.expiresAt) <= new Date()) {
      if (!token.refreshToken) {
        throw new Error("Refresh token not available");
      }
      const refreshed = await googleCalendarService.refreshAccessToken(decryptToken(token.refreshToken));
      accessToken = refreshed.accessToken;

      // Update tokens - IMPORTANT: Save new refresh token if Google provides one!
      const tokenUpdate: Parameters<typeof storage.updateGoogleOAuthToken>[1] = {
        accessToken: encryptToken(accessToken),
        expiresAt: refreshed.expiresAt,
      };
      if (refreshed.refreshToken) {
        tokenUpdate.refreshToken = encryptToken(refreshed.refreshToken);
        logger.info("[Jobs:GoogleCalendar] Saved new refresh token", { userId: payload.userId });
      }
      await storage.updateGoogleOAuthToken(payload.userId, tokenUpdate);
    }

    const calendarId = token.calendarId || "primary";
    let imported = 0;
    let updated = 0;
    let deleted = 0;

    // Try incremental sync
    let result = await googleCalendarService.listEvents(accessToken, calendarId, {
      syncToken: token.syncToken || undefined,
    });

    if (result.syncTokenInvalid) {
      result = await googleCalendarService.listEvents(accessToken, calendarId);
    }

    for (const googleEvent of result.events) {
      const existingEvent = await storage.getCalendarEventByGoogleId(googleEvent.id, payload.userId);

      if (googleEvent.cancelled) {
        if (existingEvent) {
          await storage.deleteCalendarEvent(existingEvent.id);
          deleted++;
        }
      } else if (existingEvent) {
        await storage.updateCalendarEvent(existingEvent.id, {
          title: googleEvent.summary,
          description: googleEvent.description || null,
          location: googleEvent.location || null,
          startTime: googleEvent.start,
          endTime: googleEvent.end,
          allDay: googleEvent.allDay,
          attendees: googleEvent.attendees || null,
          lastSyncedAt: new Date(),
        });
        updated++;
      } else {
        const crmEvent = googleCalendarService.googleEventToCrmEvent(
          googleEvent,
          payload.userId,
          payload.organizationId,
          calendarId
        );
        await storage.createCalendarEvent(crmEvent);
        imported++;
      }
    }

    // Update sync status
    await storage.updateGoogleOAuthToken(payload.userId, {
      syncStatus: "idle",
      lastSyncAt: new Date(),
      syncError: null,
      syncToken: result.nextSyncToken || null,
    });

    logger.info("[Jobs:GoogleCalendar] Sync completed", {
      userId: payload.userId,
      imported,
      updated,
      deleted,
    });

    return { imported, updated, deleted };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await storage.updateGoogleOAuthToken(payload.userId, {
      syncStatus: "error",
      syncError: errorMsg,
    });
    throw error;
  }
}

/**
 * Sync email in background
 */
async function handleSyncEmail(payload: SyncEmailPayload): Promise<{
  newEmails: number;
  errors: string[];
}> {
  const { syncEmails } = await import("../integrations/email");

  logger.info("[Jobs:Email] Starting sync", { channelConfigId: payload.channelConfigId });

  const config = await storage.getChannelConfig(payload.channelConfigId);
  if (!config || config.type !== "email") {
    throw new Error("Email channel config not found");
  }

  const emailConfig = config.emailConfig as EmailConfig | undefined;
  if (!emailConfig) {
    throw new Error("Email configuration is missing");
  }

  const lastSyncUid = emailConfig.lastSyncUid;
  const result = await syncEmails(emailConfig, lastSyncUid, async (email: ParsedEmail) => {
    // Process each email (same logic as in channelConfigs.ts)
    const senderEmail = email.from[0]?.address;
    if (!senderEmail) return;

    const externalId = email.messageId ? `email:${email.messageId}` : null;
    if (externalId) {
      const existingMessage = await storage.getMessageByExternalId(externalId);
      if (existingMessage) return;
    }

    let contact = await storage.getContactByEmail(senderEmail, payload.organizationId);

    if (!contact) {
      const senderName = email.from[0]?.name || senderEmail.split("@")[0];
      const nameParts = senderName.split(" ");
      contact = await storage.createContact({
        firstName: nameParts[0] || senderName,
        lastName: nameParts.slice(1).join(" ") || "",
        email: senderEmail,
        organizationId: payload.organizationId,
        source: "email",
      });
    }

    const existingConversations = await storage.getConversationsByContact(contact.id);
    let conversation = existingConversations.find(
      (c) => c.channel === "email" && c.subject === email.subject
    );

    if (!conversation) {
      conversation = await storage.createConversation({
        subject: email.subject,
        channel: "email",
        status: "open",
        contactId: contact.id,
        organizationId: payload.organizationId,
        assignedToId: payload.userId,
      });
    }

    const content = email.text || (email.html ? email.html.replace(/<[^>]*>/g, " ").trim() : "(Sem conteúdo)");

    await storage.createMessage({
      conversationId: conversation.id,
      content,
      contentType: "text",
      senderType: "contact",
      isInternal: false,
      externalId: externalId || undefined,
      metadata: {
        emailMessageId: email.messageId,
        emailDate: email.date.toISOString(),
      } as any,
    });

    await storage.updateConversation(conversation.id, {
      lastMessageAt: new Date(),
      unreadCount: (conversation.unreadCount || 0) + 1,
      status: "open",
    });
  });

  const updates = {
    lastSyncAt: new Date(),
    emailConfig: result.lastUid !== undefined ? { ...emailConfig, lastSyncUid: result.lastUid } : emailConfig,
  };
  await storage.updateChannelConfig(payload.channelConfigId, updates);

  logger.info("[Jobs:Email] Sync completed", {
    channelConfigId: payload.channelConfigId,
    newEmails: result.newEmails,
    errors: result.errors.length,
  });

  return { newEmails: result.newEmails, errors: result.errors };
}

/**
 * Cleanup orphan files in background
 */
async function handleCleanupOrphanFiles(payload: CleanupOrphanFilesPayload): Promise<{
  orphanedFiles: number;
  deletedFromDb: number;
  deletedFromStorage: number;
  errors: string[];
}> {
  const { cleanupOrphanFiles } = await import("./file-cleanup");

  logger.info("[Jobs:FileCleanup] Starting orphan file cleanup", {
    dryRun: payload.dryRun,
    limit: payload.limit,
    olderThanDays: payload.olderThanDays,
  });

  const result = await cleanupOrphanFiles({
    dryRun: payload.dryRun ?? false,
    limit: payload.limit ?? 100,
    olderThanDays: payload.olderThanDays ?? 7,
  });

  logger.info("[Jobs:FileCleanup] Cleanup completed", {
    orphanedFiles: result.orphanedFiles,
    deletedFromDb: result.deletedFromDb,
    deletedFromStorage: result.deletedFromStorage,
    errors: result.errors.length,
  });

  return result;
}

/**
 * Cleanup old dead letter queue entries
 */
async function handleCleanupDLQ(payload: CleanupDLQPayload): Promise<{
  deletedCount: number;
}> {
  const { cleanupOldDeadLetterJobs } = await import("./dead-letter");

  logger.info("[Jobs:DLQ] Starting DLQ cleanup", {
    maxAgeMs: payload.maxAgeMs,
  });

  const deletedCount = await cleanupOldDeadLetterJobs(payload.maxAgeMs);

  logger.info("[Jobs:DLQ] Cleanup completed", { deletedCount });

  return { deletedCount };
}

// ==================== REGISTER ALL HANDLERS ====================

export function initializeJobHandlers(): void {
  registerJobHandler(JobTypes.TRANSCRIBE_AUDIO, handleTranscribeAudio);
  registerJobHandler(JobTypes.CALCULATE_LEAD_SCORE, handleCalculateLeadScore);
  registerJobHandler(JobTypes.SYNC_GOOGLE_CALENDAR, handleSyncGoogleCalendar);
  registerJobHandler(JobTypes.SYNC_EMAIL, handleSyncEmail);
  registerJobHandler(JobTypes.CLEANUP_ORPHAN_FILES, handleCleanupOrphanFiles);
  registerJobHandler(JobTypes.CLEANUP_DLQ, handleCleanupDLQ);

  logger.info("[Jobs] All job handlers initialized");
}
