import type { Express } from "express";
import type { InsertChannelConfig } from "@shared/schema";
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
import { broadcast, broadcastToConversation } from "../ws/index";
import { evolutionApi } from "../integrations/evolution/api";
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

/**
 * Process an incoming email and create/update conversation and message
 */
async function processIncomingEmail(
  email: ParsedEmail,
  channelConfigId: number,
  organizationId: number,
  defaultUserId: string
): Promise<void> {
  // Extract sender email
  const senderEmail = email.from[0]?.address;
  if (!senderEmail) {
    logger.warn("[Email] Skipping email without sender", { messageId: email.messageId });
    return;
  }

  const externalId = email.messageId ? `email:${email.messageId}` : null;
  if (externalId) {
    const existingMessage = await storage.getMessageByExternalId(externalId);
    if (existingMessage) {
      logger.info("[Email] Skipping duplicate email message", { externalId });
      return;
    }
  }

  // Try to find existing contact by email
  let contact = await storage.getContactByEmail(senderEmail, organizationId);

  // Create contact if not found
  if (!contact) {
    const senderName = email.from[0]?.name || senderEmail.split("@")[0];
    const nameParts = senderName.split(" ");
    const firstName = nameParts[0] || senderName;
    const lastName = nameParts.slice(1).join(" ") || "";

    contact = await storage.createContact({
      firstName,
      lastName,
      email: senderEmail,
      organizationId,
      source: "email",
    });

    logger.info("[Email] Created new contact from email", {
      contactId: contact.id,
      email: senderEmail,
    });
  }

  // Try to find existing conversation by references/inReplyTo or create new
  let conversation = null;

  // Look for existing conversation by subject + contact (simplified threading)
  const existingConversations = await storage.getConversationsByContact(contact.id);
  for (const conv of existingConversations) {
    if (conv.channel === "email" && conv.subject === email.subject) {
      conversation = conv;
      break;
    }
  }

  // Create new conversation if not found
  if (!conversation) {
    conversation = await storage.createConversation({
      subject: email.subject,
      channel: "email",
      status: "open",
      contactId: contact.id,
      organizationId,
      assignedToId: defaultUserId,
    });

    logger.info("[Email] Created new conversation", {
      conversationId: conversation.id,
      subject: email.subject,
    });

    broadcast("conversation:created", conversation);
  }

  // Build message content (prefer text, fallback to stripped HTML)
  const content = email.text || (email.html ? email.html.replace(/<[^>]*>/g, " ").trim() : "(Sem conteúdo)");

  // Create the message
  const message = await storage.createMessage({
    conversationId: conversation.id,
    content,
    contentType: "text",
    senderType: "contact",
    isInternal: false,
    externalId: externalId || undefined,
    // Store email-specific metadata (schema allows any JSON)
    metadata: {
      emailMessageId: email.messageId,
      emailFrom: email.from,
      emailTo: email.to,
      emailCc: email.cc,
      emailDate: email.date.toISOString(),
      hasAttachments: email.attachments.length > 0,
    } as any,
  });

  // Update conversation with last message timestamp
  await storage.updateConversation(conversation.id, {
    lastMessageAt: new Date(),
    unreadCount: (conversation.unreadCount || 0) + 1,
    status: "open",
  });

  // Broadcast direcionado para usuarios inscritos na conversa
  broadcastToConversation(conversation.id, "message:created", { ...message, conversation });

  logger.info("[Email] Processed incoming email", {
    messageId: email.messageId,
    conversationId: conversation.id,
    contactId: contact.id,
  });
}

function redactChannelConfigSecrets(config: any) {
  const redacted = { ...config };
  if (redacted.emailConfig) {
    const emailConfig = { ...redacted.emailConfig };
    if (emailConfig.password) {
      emailConfig.hasPassword = true;
      delete emailConfig.password;
    }
    redacted.emailConfig = emailConfig;
  }
  if (redacted.whatsappConfig) {
    const whatsappConfig = { ...redacted.whatsappConfig };
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
  // GET /api/channel-configs - Listar todas as configuracoes de canal
  app.get(
    "/api/channel-configs",
    isAuthenticated,
    asyncHandler(async (_req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);
      const configs = await storage.getChannelConfigs(org.id);
      const redactedConfigs = configs.map(redactChannelConfigSecrets);
      sendSuccess(res, redactedConfigs);
    }),
  );

  // GET /api/channel-configs/:id - Obter configuracao por ID
  app.get(
    "/api/channel-configs/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      sendSuccess(res, redactChannelConfigSecrets(config));
    }),
  );

  // POST /api/channel-configs - Criar configuracao de canal
  app.post(
    "/api/channel-configs",
    isAuthenticated,
    validateBody(createChannelConfigSchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = (req.user as any).id;

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

  // PATCH /api/channel-configs/:id - Atualizar configuracao de canal
  app.patch(
    "/api/channel-configs/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateChannelConfigSchema),
    asyncHandler(async (req: any, res) => {
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

  // DELETE /api/channel-configs/:id - Excluir configuracao de canal
  app.delete(
    "/api/channel-configs/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;

      await storage.deleteChannelConfig(id);
      broadcast("channel:config:deleted", { id });
      res.status(204).send();
    }),
  );

  // POST /api/channel-configs/:id/test - Testar configuracao de canal
  app.post(
    "/api/channel-configs/:id/test",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
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

  // POST /api/channel-configs/:id/email/sync - Sincronizar emails
  app.post(
    "/api/channel-configs/:id/email/sync",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
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

      const user = req.user as any;
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

  // POST /api/channel-configs/:id/email/send - Enviar email
  app.post(
    "/api/channel-configs/:id/email/send",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
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

  // POST /api/channel-configs/:id/whatsapp/connect - Conectar WhatsApp
  app.post(
    "/api/channel-configs/:id/whatsapp/connect",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      if (!evolutionApi.isConfigured()) {
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, "Evolution API is not configured", 503);
      }

      if (process.env.NODE_ENV === "production" && !process.env.EVOLUTION_WEBHOOK_SECRET) {
        return sendError(
          res,
          ErrorCodes.INTERNAL_ERROR,
          "EVOLUTION_WEBHOOK_SECRET is required in production to validate webhooks",
          500
        );
      }

      const organizationId = config.organizationId;
      const baseInstanceName = `crm-org-${organizationId}-channel-${id}`;
      const rawInstancePrefix = process.env.EVOLUTION_INSTANCE_PREFIX?.trim();
      const instancePrefix = rawInstancePrefix ? rawInstancePrefix.replace(/-+$/, "") : undefined;
      const instanceName = instancePrefix ? `${instancePrefix}-${baseInstanceName}` : baseInstanceName;

      // Check if instance already exists
      const existingInstance = await evolutionApi.getInstanceInfo(instanceName);

      if (!existingInstance) {
        // Create new instance
        await evolutionApi.createInstance(instanceName);
      }

      // Set (or refresh) webhook URL for this instance
      const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
      const webhookUrl = new URL("/api/webhooks/evolution", appUrl);
      if (webhookSecret) {
        webhookUrl.searchParams.set("token", webhookSecret);
      }
      await evolutionApi.setWebhook(instanceName, webhookUrl.toString());

      // Get QR code
      const qrData = await evolutionApi.getQrCode(instanceName);

      // Update channel config with instance name and QR code
      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      whatsappConfig.instanceName = instanceName;
      whatsappConfig.qrCode = qrData.base64 || qrData.code;
      whatsappConfig.connectionStatus = "qr_pending";

      await storage.updateChannelConfig(id, {
        whatsappConfig: whatsappConfig as any,
      });

      // Audit log for WhatsApp connection initiated
      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "integration",
        entityId: id,
        entityName: `WhatsApp: ${config.name}`,
        organizationId,
        changes: {
          after: {
            type: "whatsapp",
            instanceName,
            status: "qr_pending",
            initiatedAt: new Date().toISOString(),
          },
        },
      });

      sendSuccess(res, {
        instanceName,
        qrCode: qrData.base64 || qrData.code,
        pairingCode: qrData.pairingCode,
        status: "qr_pending",
      });
    }),
  );

  // GET /api/channel-configs/:id/whatsapp/status - Status do WhatsApp
  app.get(
    "/api/channel-configs/:id/whatsapp/status",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return sendSuccess(res, {
          status: "disconnected",
          instanceName: null,
        });
      }

      if (!evolutionApi.isConfigured()) {
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, "Evolution API is not configured", 503);
      }

      try {
        const connectionState = await evolutionApi.getConnectionStatus(instanceName);

        // Map Evolution API states to our states
        const statusMap: Record<string, string> = {
          open: "connected",
          close: "disconnected",
          connecting: "connecting",
        };

        const status = statusMap[connectionState.state] || "disconnected";

        // Update config if status changed
        if (whatsappConfig.connectionStatus !== status) {
          whatsappConfig.connectionStatus = status;
          if (status === "connected") {
            whatsappConfig.lastConnectedAt = new Date().toISOString();
            whatsappConfig.qrCode = undefined; // Clear QR code on connect
          }
          await storage.updateChannelConfig(id, {
            whatsappConfig: whatsappConfig as any,
          });
        }

        sendSuccess(res, {
          status,
          instanceName,
          lastConnectedAt: whatsappConfig.lastConnectedAt,
        });
      } catch {
        // Instance might not exist or is disconnected
        sendSuccess(res, {
          status: "disconnected",
          instanceName,
        });
      }
    }),
  );

  // POST /api/channel-configs/:id/whatsapp/disconnect - Desconectar WhatsApp
  app.post(
    "/api/channel-configs/:id/whatsapp/disconnect",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const config = await storage.getChannelConfig(id);
      if (!config) {
        return sendNotFound(res, "Channel config not found");
      }
      if (config.type !== "whatsapp") {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Not a WhatsApp channel", 400);
      }

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return sendSuccess(res, { success: true, message: "No active connection" });
      }

      if (!evolutionApi.isConfigured()) {
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, "Evolution API is not configured", 503);
      }

      try {
        await evolutionApi.disconnectInstance(instanceName);
      } catch (error) {
        // Instance might already be disconnected
        logger.warn("Instance disconnect error (may already be disconnected):", { error });
      }

      // Update config
      whatsappConfig.connectionStatus = "disconnected";
      whatsappConfig.qrCode = undefined;

      await storage.updateChannelConfig(id, {
        whatsappConfig: whatsappConfig as any,
      });

      // Audit log for WhatsApp disconnection
      await storage.createAuditLog({
        userId,
        action: "delete",
        entityType: "integration",
        entityId: id,
        entityName: `WhatsApp: ${config.name}`,
        organizationId: config.organizationId,
        changes: {
          before: {
            type: "whatsapp",
            instanceName,
            disconnectedAt: new Date().toISOString(),
          },
        },
      });

      sendSuccess(res, { success: true, message: "WhatsApp disconnected" });
    }),
  );

  // POST /api/channel-configs/:id/whatsapp/send - Enviar mensagem WhatsApp
  app.post(
    "/api/channel-configs/:id/whatsapp/send",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
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

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "WhatsApp not connected", 400);
      }

      if (!evolutionApi.isConfigured()) {
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, "Evolution API is not configured", 503);
      }

      let result;
      if (mediaUrl && mediaType) {
        result = await evolutionApi.sendMediaMessage(instanceName, to, mediaUrl, mediaType, caption, fileName);
      } else {
        result = await evolutionApi.sendTextMessage(instanceName, to, text);
      }

      sendSuccess(res, { success: true, result });
    }),
  );
}
