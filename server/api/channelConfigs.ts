/**
 * Channel Configuration API Routes
 * Handles channel config CRUD and channel-specific operations (email, WhatsApp)
 */

import type { Express } from "express";
import type { InsertChannelConfig, ChannelConfig } from "@shared/schema";
import {
  createChannelConfigSchema,
  updateChannelConfigSchema,
  idParamSchema,
} from "../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  asyncHandler,
} from "../middleware";
import { sendSuccess, sendNotFound, sendError, sendValidationError, ErrorCodes } from "../response";
import { storage } from "../storage";
import { broadcast } from "../ws/index";
import {
  verifySmtpConnection,
  verifyImapConnection,
  sendEmail,
  syncEmails,
  type EmailConfig,
  type ParsedEmail,
} from "../integrations/email";
import { logger } from "../logger";
import { enqueueJob } from "../jobs/queue";
import { JobTypes, type SyncEmailPayload } from "../jobs/handlers";
import { processIncomingEmail } from "../services/email-ingest";
import {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendWhatsAppMessage,
} from "../services/whatsapp-config";

/**
 * Redact sensitive fields from channel config before sending to client
 */
function redactChannelConfigSecrets(config: ChannelConfig) {
  const redacted = { ...config } as Record<string, unknown>;
  if (redacted.emailConfig) {
    const emailConfig = { ...(redacted.emailConfig as Record<string, unknown>) };
    if (emailConfig.password) {
      emailConfig.hasPassword = true;
      delete emailConfig.password;
    }
    redacted.emailConfig = emailConfig;
  }
  if (redacted.whatsappConfig) {
    const whatsappConfig = { ...(redacted.whatsappConfig as Record<string, unknown>) };
    if (whatsappConfig.accessToken) {
      whatsappConfig.hasAccessToken = true;
      delete whatsappConfig.accessToken;
    }
    if (whatsappConfig.webhookVerifyToken) {
      whatsappConfig.hasWebhookVerifyToken = true;
      delete whatsappConfig.webhookVerifyToken;
    }
    redacted.whatsappConfig = whatsappConfig;
  }
  return redacted;
}

export function registerChannelConfigRoutes(app: Express) {
  // ========== CRUD ROUTES ==========

  // GET /api/channel-configs - List all channel configs
  app.get(
    "/api/channel-configs",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);
      const configs = await storage.getChannelConfigs(org.id);
      const redactedConfigs = configs.map(redactChannelConfigSecrets);
      sendSuccess(res, redactedConfigs);
    }),
  );

  // GET /api/channel-configs/:id - Get channel config by ID
  app.get(
    "/api/channel-configs/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      sendSuccess(res, redactChannelConfigSecrets(config));
    }),
  );

  // POST /api/channel-configs - Create channel config
  app.post(
    "/api/channel-configs",
    isAuthenticated,
    validateBody(createChannelConfigSchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = req.user!.id;

      const config = await storage.createChannelConfig({
        ...req.validatedBody,
        organizationId: org.id,
        createdBy: userId,
      });
      const redactedConfig = redactChannelConfigSecrets(config);
      broadcast("channel:config:created", redactedConfig);
      sendSuccess(res, redactedConfig, 201);
    }),
  );

  // PATCH /api/channel-configs/:id - Update channel config
  app.patch(
    "/api/channel-configs/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateChannelConfigSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      // Storage layer handles merging secrets - preserves password/accessToken if not provided
      const config = await storage.updateChannelConfig(id, req.validatedBody);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      const redactedConfig = redactChannelConfigSecrets(config);
      broadcast("channel:config:updated", redactedConfig);
      sendSuccess(res, redactedConfig);
    }),
  );

  // DELETE /api/channel-configs/:id - Delete channel config
  app.delete(
    "/api/channel-configs/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      await storage.deleteChannelConfig(id);
      broadcast("channel:config:deleted", { id });
      res.status(204).send();
    }),
  );

  // POST /api/channel-configs/:id/test - Test channel config connection
  app.post(
    "/api/channel-configs/:id/test",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }

      if (config.type === "email") {
        const emailConfig = config.emailConfig as EmailConfig | undefined;
        if (!emailConfig) {
          return sendError(res, ErrorCodes.INVALID_INPUT, "Email configuration is missing", 400);
        }

        // Test both IMAP and SMTP connections
        const [imapOk, smtpOk] = await Promise.all([
          verifyImapConnection(emailConfig),
          verifySmtpConnection(emailConfig),
        ]);

        if (imapOk && smtpOk) {
          sendSuccess(res, { success: true, message: "Email configuration validated successfully", imap: true, smtp: true });
        } else {
          sendSuccess(res, {
            success: false,
            message: "Email configuration validation failed",
            imap: imapOk,
            smtp: smtpOk,
          });
        }
      } else if (config.type === "whatsapp") {
        sendSuccess(res, { success: true, message: "WhatsApp configuration validated successfully" });
      } else {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Unknown channel type", 400);
      }
    }),
  );

  // ========== EMAIL ROUTES ==========

  // POST /api/channel-configs/:id/email/sync - Sync emails
  app.post(
    "/api/channel-configs/:id/email/sync",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const async = req.query.async === "true";

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "email") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not an email channel", 400);
      }

      const emailConfig = config.emailConfig as EmailConfig | undefined;
      if (!emailConfig) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Email configuration is missing", 400);
      }

      const user = req.user!;
      const organizationId = config.organizationId;

      // Async mode: queue the job
      if (async) {
        const payload: SyncEmailPayload = {
          channelConfigId: id,
          organizationId,
          userId: user.id,
        };

        const job = await enqueueJob(JobTypes.SYNC_EMAIL, payload);

        return sendSuccess(
          res,
          {
            message: "Email sync queued",
            jobId: job.id,
            status: job.status,
          },
          202
        );
      }

      // Sync mode: sync immediately
      const lastSyncUid = emailConfig.lastSyncUid;

      // Sync emails and create conversations/messages
      const result = await syncEmails(emailConfig, lastSyncUid, async (email: ParsedEmail) => {
        await processIncomingEmail(email, config.id, organizationId, user.id);
      });

      // Update last sync timestamp and UID
      const updates: Partial<InsertChannelConfig> = {
        lastSyncAt: new Date(),
      };
      if (result.lastUid !== undefined) {
        updates.emailConfig = { ...emailConfig, lastSyncUid: result.lastUid } as InsertChannelConfig["emailConfig"];
      }
      await storage.updateChannelConfig(id, updates);

      logger.info("[Email] Sync completed", {
        channelId: id,
        newEmails: result.newEmails,
        errors: result.errors.length,
      });

      sendSuccess(res, {
        newEmails: result.newEmails,
        totalProcessed: result.totalProcessed,
        errors: result.errors,
      });
    }),
  );

  // POST /api/channel-configs/:id/email/send - Send email
  app.post(
    "/api/channel-configs/:id/email/send",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const { to, cc, bcc, subject, text, html, inReplyTo, references } = req.body;

      if (!to) {
        return sendValidationError(res, "Recipient (to) is required", [{ path: "to", message: "Required" }]);
      }
      if (!subject) {
        return sendValidationError(res, "Subject is required", [{ path: "subject", message: "Required" }]);
      }
      if (!text && !html) {
        return sendValidationError(res, "Either text or html body is required", [{ path: "text", message: "Required" }]);
      }

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "email") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not an email channel", 400);
      }

      const emailConfig = config.emailConfig as EmailConfig | undefined;
      if (!emailConfig) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Email configuration is missing", 400);
      }

      const result = await sendEmail(emailConfig, {
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        inReplyTo,
        references,
      });

      logger.info("[Email] Message sent", {
        channelId: id,
        messageId: result.messageId,
        to,
      });

      sendSuccess(res, {
        success: true,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
      });
    }),
  );

  // ========== WHATSAPP ROUTES ==========

  // POST /api/channel-configs/:id/whatsapp/connect - Connect WhatsApp
  app.post(
    "/api/channel-configs/:id/whatsapp/connect",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const userId = req.user!.id;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      try {
        const result = await connectWhatsApp(config, userId);
        sendSuccess(res, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("not configured")) {
          return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, message, 503);
        }
        return sendError(res, ErrorCodes.INTERNAL_ERROR, message, 500);
      }
    }),
  );

  // GET /api/channel-configs/:id/whatsapp/status - WhatsApp status
  app.get(
    "/api/channel-configs/:id/whatsapp/status",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      try {
        const result = await getWhatsAppStatus(config);
        sendSuccess(res, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, message, 503);
      }
    }),
  );

  // POST /api/channel-configs/:id/whatsapp/disconnect - Disconnect WhatsApp
  app.post(
    "/api/channel-configs/:id/whatsapp/disconnect",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const userId = req.user!.id;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      try {
        const result = await disconnectWhatsApp(config, userId);
        sendSuccess(res, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, message, 503);
      }
    }),
  );

  // POST /api/channel-configs/:id/whatsapp/send - Send WhatsApp message
  app.post(
    "/api/channel-configs/:id/whatsapp/send",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const { to, text, mediaUrl, mediaType, caption, fileName } = req.body;

      if (!to) {
        return sendValidationError(res, "Recipient phone number (to) is required", [{ path: "to", message: "Required" }]);
      }
      if (!text && !mediaUrl) {
        return sendValidationError(res, "Either text or mediaUrl is required", [{ path: "text", message: "Required" }]);
      }

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      try {
        const result = await sendWhatsAppMessage(config, to, { text, mediaUrl, mediaType, caption, fileName });
        sendSuccess(res, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("not connected") || message.includes("not configured")) {
          return sendError(res, ErrorCodes.INVALID_INPUT, message, 400);
        }
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, message, 503);
      }
    }),
  );
}
