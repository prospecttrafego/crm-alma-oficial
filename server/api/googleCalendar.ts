import type { Express } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";
import { enqueueJob } from "../jobs/queue";
import { JobTypes, type SyncGoogleCalendarPayload } from "../jobs/handlers";
import { asyncHandler, validateQuery, getCurrentUser } from "../middleware";
import { sendSuccess, sendValidationError, sendServiceUnavailable } from "../response";
import { logger } from "../logger";

// Schemas de validacao
const asyncQuerySchema = z.object({
  async: z.string().optional(),
});

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

function signOAuthState(payload: { userId: string; timestamp: number }): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  const data = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  return `${data}.${signature}`;
}

function verifyOAuthState(state: string): { userId: string; timestamp: number } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const [data, signature] = state.split(".");
  if (!data || !signature) return null;

  const expected = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(base64UrlDecode(data).toString("utf8"));
  } catch {
    return null;
  }
}

export function registerGoogleCalendarRoutes(app: Express) {
  // Check if Google Calendar is configured
  app.get(
    "/api/integrations/google-calendar/configured",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const { googleCalendarService } = await import("../integrations/google/calendar");
      sendSuccess(res, { configured: googleCalendarService.isConfigured() });
    })
  );

  // Get Google Calendar connection status
  app.get(
    "/api/integrations/google-calendar/status",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const token = await storage.getGoogleOAuthToken(userId);

      if (!token || !token.isActive) {
        return sendSuccess(res, {
          connected: false,
          email: null,
          lastSyncAt: null,
          syncStatus: null,
        });
      }

      sendSuccess(res, {
        connected: true,
        email: token.email,
        lastSyncAt: token.lastSyncAt,
        syncStatus: token.syncStatus,
        syncError: token.syncError,
      });
    })
  );

  // Initiate OAuth flow - returns authorization URL
  app.get(
    "/api/auth/google/authorize",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const { googleCalendarService } = await import("../integrations/google/calendar");

      if (!googleCalendarService.isConfigured()) {
        return sendServiceUnavailable(res, "Google Calendar integration is not configured");
      }

      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const state = signOAuthState({ userId, timestamp: Date.now() });

      const authUrl = googleCalendarService.getAuthUrl(state);
      sendSuccess(res, { authUrl });
    })
  );

  // OAuth callback - handles code exchange
  // Note: This route uses redirects, so we keep try/catch pattern here
  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        logger.error("OAuth error", { error: oauthError });
        return res.redirect("/settings?google_calendar=error&message=" + encodeURIComponent(String(oauthError)));
      }

      if (!code || !state) {
        return res.redirect("/settings?google_calendar=error&message=missing_params");
      }

      const stateData = verifyOAuthState(String(state));
      if (!stateData?.userId || !stateData.timestamp) {
        return res.redirect("/settings?google_calendar=error&message=invalid_state");
      }

      // Prevent very old states (10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        return res.redirect("/settings?google_calendar=error&message=state_expired");
      }

      const user = await storage.getUser(stateData.userId);
      if (!user) {
        return res.redirect("/settings?google_calendar=error&message=invalid_user");
      }

      const { googleCalendarService, encryptToken } = await import("../integrations/google/calendar");

      // Exchange code for tokens
      const tokens = await googleCalendarService.exchangeCode(String(code));

      // Encrypt tokens before storing
      const encryptedAccessToken = encryptToken(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

      // Store tokens
      await storage.createGoogleOAuthToken({
        userId: stateData.userId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenType: tokens.tokenType,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        email: tokens.email,
        calendarId: "primary", // Default to primary calendar
        isActive: true,
        syncStatus: "idle",
      });

      // Audit log for Google Calendar connection
      if (user.organizationId) {
        await storage.createAuditLog({
          userId: stateData.userId,
          action: "create",
          entityType: "integration",
          entityId: 0, // No specific entity ID for integrations
          entityName: "Google Calendar",
          organizationId: user.organizationId,
          changes: {
            after: {
              type: "google_calendar",
              email: tokens.email,
              connectedAt: new Date().toISOString(),
            },
          },
        });
      }

      res.redirect("/settings?google_calendar=success");
    } catch (error) {
      logger.error("Error in Google OAuth callback", { error: error instanceof Error ? error.message : String(error) });
      res.redirect("/settings?google_calendar=error&message=exchange_failed");
    }
  });

  // Disconnect Google Calendar
  app.post(
    "/api/integrations/google-calendar/disconnect",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const user = await storage.getUser(userId);
      const token = await storage.getGoogleOAuthToken(userId);

      if (token) {
        const tokenEmail = token.email;

        // Try to revoke the token
        try {
          const { googleCalendarService, decryptToken } = await import("../integrations/google/calendar");
          const accessToken = decryptToken(token.accessToken);
          await googleCalendarService.revokeTokens(accessToken);
        } catch (revokeError) {
          logger.info("Token revocation failed (continuing with deletion)", { error: revokeError });
        }

        // Delete from database
        await storage.deleteGoogleOAuthToken(userId);

        // Audit log for Google Calendar disconnection
        if (user?.organizationId) {
          await storage.createAuditLog({
            userId,
            action: "delete",
            entityType: "integration",
            entityId: 0,
            entityName: "Google Calendar",
            organizationId: user.organizationId,
            changes: {
              before: {
                type: "google_calendar",
                email: tokenEmail,
                disconnectedAt: new Date().toISOString(),
              },
            },
          });
        }
      }

      sendSuccess(res, { success: true });
    })
  );

  // Trigger manual sync (supports incremental sync)
  app.post(
    "/api/integrations/google-calendar/sync",
    isAuthenticated,
    validateQuery(asyncQuerySchema),
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const isAsync = req.validatedQuery?.async === "true";

      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return sendValidationError(res, "User organization not found");
      }

      const token = await storage.getGoogleOAuthToken(userId);
      if (!token || !token.isActive) {
        return sendValidationError(res, "Google Calendar not connected");
      }

      // Async mode: queue the job
      if (isAsync) {
        const payload: SyncGoogleCalendarPayload = {
          userId,
          organizationId: user.organizationId,
        };

        const job = await enqueueJob(JobTypes.SYNC_GOOGLE_CALENDAR, payload);

        // Mark as syncing
        await storage.updateGoogleOAuthToken(userId, { syncStatus: "syncing", syncError: null });

        return sendSuccess(
          res,
          {
            message: "Google Calendar sync queued",
            jobId: job.id,
            status: job.status,
          },
          202
        );
      }

      const { googleCalendarService, decryptToken, encryptToken } = await import("../integrations/google/calendar");

      // Update sync status
      await storage.updateGoogleOAuthToken(userId, { syncStatus: "syncing", syncError: null });

      try {
        // Decrypt access token
        let accessToken = decryptToken(token.accessToken);

        // Check if token is expired and refresh if needed
        if (token.expiresAt && new Date(token.expiresAt) <= new Date()) {
          if (!token.refreshToken) {
            throw new Error("Refresh token not available");
          }
          const refreshedTokens = await googleCalendarService.refreshAccessToken(decryptToken(token.refreshToken));
          accessToken = refreshedTokens.accessToken;

          // Update stored token
          await storage.updateGoogleOAuthToken(userId, {
            accessToken: encryptToken(accessToken),
            expiresAt: refreshedTokens.expiresAt,
          });
        }

        const calendarId = token.calendarId || "primary";
        let imported = 0;
        let updated = 0;
        let deleted = 0;

        // Try incremental sync if we have a syncToken
        let result = await googleCalendarService.listEvents(accessToken, calendarId, {
          syncToken: token.syncToken || undefined,
        });

        // If syncToken is invalid, do a full sync
        if (result.syncTokenInvalid) {
          logger.info("[Google Calendar] SyncToken invalid, performing full sync");
          result = await googleCalendarService.listEvents(accessToken, calendarId);
        }

        const nextSyncToken = result.nextSyncToken;

        // Process events
        for (const googleEvent of result.events) {
          const existingEvent = await storage.getCalendarEventByGoogleId(googleEvent.id, userId);

          if (googleEvent.cancelled) {
            // Event was deleted in Google Calendar
            if (existingEvent) {
              await storage.deleteCalendarEvent(existingEvent.id);
              deleted++;
            }
          } else if (existingEvent) {
            // Update existing event
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
            // Create new event
            const crmEvent = googleCalendarService.googleEventToCrmEvent(
              googleEvent,
              userId,
              user.organizationId,
              calendarId
            );
            await storage.createCalendarEvent(crmEvent);
            imported++;
          }
        }

        // Update sync status and store the new syncToken
        await storage.updateGoogleOAuthToken(userId, {
          syncStatus: "idle",
          lastSyncAt: new Date(),
          syncError: null,
          syncToken: nextSyncToken || null,
        });

        // Broadcast sync complete via WebSocket
        broadcast("google_calendar:sync_complete", { userId, imported, updated, deleted });

        sendSuccess(res, {
          success: true,
          imported,
          updated,
          deleted,
          incremental: !!token.syncToken && !result.syncTokenInvalid,
        });
      } catch (syncError: any) {
        await storage.updateGoogleOAuthToken(userId, {
          syncStatus: "error",
          syncError: syncError.message || "Sync failed",
        });
        throw syncError;
      }
    })
  );
}
