/**
 * Shared API response schemas (runtime validation)
 *
 * Goal: eliminate Backend↔Frontend drift by validating responses at the boundary.
 * These schemas are derived from Drizzle (via drizzle-zod select schemas) and
 * extended only where the API returns computed/redacted fields.
 */

import { z } from "zod";
import {
  whatsappConnectionStatuses,
  selectActivitySchema,
  selectAuditLogSchema,
  selectCalendarEventSchema,
  selectChannelConfigSchema,
  selectCompanySchema,
  selectContactSchema,
  selectConversationSchema,
  selectDealSchema,
  selectEmailTemplateSchema,
  selectFileSchema,
  selectLeadScoreSchema,
  selectMessageSchema,
  selectNotificationSchema,
  selectPipelineSchema,
  selectPipelineStageSchema,
  selectPushTokenSchema,
  selectSavedViewSchema,
  selectUserSchema,
} from "./schema";

// ======================================================================
// Common helpers
// ======================================================================

export const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .strict();

export function paginatedResultSchema<TItem extends z.ZodTypeAny>(itemSchema: TItem) {
  return z
    .object({
      data: z.array(itemSchema),
      pagination: paginationMetaSchema,
    })
    .strict();
}

export const jobQueuedSchema = z
  .object({
    message: z.string(),
    jobId: z.union([z.string(), z.number()]),
    status: z.string().optional(),
  })
  .strict();

export const messageResponseSchema = z.object({ message: z.string() }).strict();
export const successFlagSchema = z.object({ success: z.boolean() }).strict();

// ======================================================================
// Canonical entity schemas (strict)
// ======================================================================

export const userSchema = selectUserSchema.strict();
export const safeUserSchema = selectUserSchema.omit({ passwordHash: true }).strict();
export type SafeUser = z.infer<typeof safeUserSchema>;

export const companySchema = selectCompanySchema.strict();
export const contactSchema = selectContactSchema.strict();
export const pipelineSchema = selectPipelineSchema.strict();
export const pipelineStageSchema = selectPipelineStageSchema.strict();
export const dealSchema = selectDealSchema.strict();
export const conversationSchema = selectConversationSchema.strict();
export const messageSchema = selectMessageSchema.strict();
export const activitySchema = selectActivitySchema.strict();
export const notificationSchema = selectNotificationSchema.strict();
export const savedViewSchema = selectSavedViewSchema.strict();
export const emailTemplateSchema = selectEmailTemplateSchema.strict();
export const auditLogSchema = selectAuditLogSchema.strict();
export const fileSchema = selectFileSchema.strict();
export const leadScoreSchema = selectLeadScoreSchema.strict();
export const calendarEventSchema = selectCalendarEventSchema.strict();
export const pushTokenSchema = selectPushTokenSchema.strict();

export const auditLogUserSchema = z
  .object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  })
  .strict();

export const enrichedAuditLogSchema = auditLogSchema.extend({ user: auditLogUserSchema.nullable() }).strict();
export type EnrichedAuditLog = z.infer<typeof enrichedAuditLogSchema>;

// ======================================================================
// Composite response payloads
// ======================================================================

export const contactWithCompanySchema = contactSchema
  .extend({
    company: companySchema.nullable().optional(),
  })
  .strict();
export type ContactWithCompany = z.infer<typeof contactWithCompanySchema>;

export const pipelineWithStagesSchema = pipelineSchema
  .extend({
    stages: z.array(pipelineStageSchema),
  })
  .strict();
export type PipelineWithStages = z.infer<typeof pipelineWithStagesSchema>;

export const conversationWithRelationsSchema = conversationSchema
  .extend({
    contact: contactWithCompanySchema.nullable().optional(),
    deal: dealSchema.nullable().optional(),
    company: companySchema.nullable().optional(),
    assignedTo: safeUserSchema.nullable().optional(),
  })
  .strict();
export type ConversationWithRelations = z.infer<typeof conversationWithRelationsSchema>;

export const messageWithSenderSchema = messageSchema
  .extend({
    sender: safeUserSchema.nullable().optional(),
  })
  .strict();
export type MessageWithSender = z.infer<typeof messageWithSenderSchema>;

export const messagesResponseSchema = z
  .object({
    messages: z.array(messageWithSenderSchema),
    nextCursor: z.number().int().positive().nullable(),
    hasMore: z.boolean(),
  })
  .strict();
export type MessagesResponse = z.infer<typeof messagesResponseSchema>;

// Dashboard
export const dashboardStatsSchema = z
  .object({
    totalDeals: z.number().int().nonnegative(),
    openDeals: z.number().int().nonnegative(),
    wonDeals: z.number().int().nonnegative(),
    lostDeals: z.number().int().nonnegative(),
    totalValue: z.number().nonnegative(),
    contacts: z.number().int().nonnegative(),
    companies: z.number().int().nonnegative(),
    newContacts: z.number().int().nonnegative(),
    pendingActivities: z.number().int().nonnegative(),
    openConversations: z.number().int().nonnegative(),
    unreadConversations: z.number().int().nonnegative(),
  })
  .strict();
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// Reports
export const reportDataSchema = z
  .object({
    dealsByStage: z.array(z.object({ stage: z.string(), count: z.number().int(), value: z.string() }).strict()),
    dealsOverTime: z.array(z.object({ date: z.string(), count: z.number().int(), value: z.string() }).strict()),
    conversionFunnel: z.array(
      z.object({ stage: z.string(), deals: z.number().int(), value: z.string(), order: z.number().int() }).strict(),
    ),
    teamPerformance: z.array(
      z
        .object({
          userId: z.string(),
          name: z.string(),
          deals: z.number().int(),
          value: z.string(),
          wonDeals: z.number().int(),
        })
        .strict(),
    ),
    activitySummary: z.array(z.object({ type: z.string(), count: z.number().int() }).strict()),
    wonLostByMonth: z.array(
      z
        .object({
          month: z.string(),
          won: z.number().int(),
          lost: z.number().int(),
          wonValue: z.string(),
          lostValue: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type ReportData = z.infer<typeof reportDataSchema>;

// Notifications
export const unreadCountSchema = z.object({ count: z.number().int().nonnegative() }).strict();

// Files
export const uploadUrlSchema = z
  .object({
    uploadURL: z.string().url(),
    objectPath: z.string(),
  })
  .strict();

export const transcriptionResultSchema = z
  .object({
    text: z.string().optional(),
    message: z.string().optional(),
    jobId: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
    fileId: z.number().int().optional(),
    fileName: z.string().optional(),
  })
  .strict();
export type TranscriptionResult = z.infer<typeof transcriptionResultSchema>;

// Integrations: Google Calendar
export const googleCalendarConfiguredSchema = z.object({ configured: z.boolean() }).strict();
export type GoogleCalendarConfigured = z.infer<typeof googleCalendarConfiguredSchema>;

export const googleCalendarStatusSchema = z
  .object({
    connected: z.boolean(),
    email: z.string().nullable(),
    lastSyncAt: z.string().nullable(),
    syncStatus: z.string().nullable(),
    syncError: z.string().nullable().optional(),
  })
  .strict();
export type GoogleCalendarStatus = z.infer<typeof googleCalendarStatusSchema>;

export const googleCalendarAuthSchema = z.object({ authUrl: z.string().url() }).strict();
export type GoogleCalendarAuth = z.infer<typeof googleCalendarAuthSchema>;

export const googleCalendarSyncResultSchema = z
  .object({
    imported: z.number().int().optional(),
    updated: z.number().int().optional(),
    deleted: z.number().int().optional(),
    message: z.string().optional(),
    jobId: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
  })
  .strict();
export type GoogleCalendarSyncResult = z.infer<typeof googleCalendarSyncResultSchema>;

// Channel configs (public/redacted)
export const emailConfigPublicSchema = z
  .object({
    imapHost: z.string(),
    imapPort: z.number().int(),
    imapSecure: z.boolean(),
    smtpHost: z.string(),
    smtpPort: z.number().int(),
    smtpSecure: z.boolean(),
    email: z.string(),
    fromName: z.string().optional(),
    lastSyncUid: z.number().int().optional(),
    hasPassword: z.boolean().optional(),
  })
  .strict();

export const whatsappConfigPublicSchema = z
  .object({
    instanceName: z.string().optional(),
    connectionStatus: z.enum(whatsappConnectionStatuses).optional(),
    qrCode: z.string().optional(),
    phoneNumber: z.string().optional(),
    lastConnectedAt: z.string().optional(),
    phoneNumberId: z.string().optional(),
    businessAccountId: z.string().optional(),
    hasAccessToken: z.boolean().optional(),
    hasWebhookVerifyToken: z.boolean().optional(),
  })
  .strict();

export const channelConfigPublicSchema = selectChannelConfigSchema
  .omit({ emailConfig: true, whatsappConfig: true })
  .extend({
    emailConfig: emailConfigPublicSchema.nullable().optional(),
    whatsappConfig: whatsappConfigPublicSchema.nullable().optional(),
  })
  .strict();
export type ChannelConfigPublic = z.infer<typeof channelConfigPublicSchema>;

// Integration-specific schemas
export * from "./apiSchemas.integrations";
