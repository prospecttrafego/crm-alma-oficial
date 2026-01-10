import type { Express } from "express";
import { insertChannelConfigSchema, type InsertChannelConfig } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";
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

const updateChannelConfigSchema = insertChannelConfigSchema.partial().omit({ organizationId: true, type: true });

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

  broadcast("message:created", { ...message, conversation });

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
    redacted.whatsappConfig = whatsappConfig;
  }
  return redacted;
}

export function registerChannelConfigRoutes(app: Express) {
  app.get("/api/channel-configs", isAuthenticated, async (_req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const configs = await storage.getChannelConfigs(org.id);
      const redactedConfigs = configs.map(redactChannelConfigSecrets);
      res.json(redactedConfigs);
    } catch (error) {
      console.error("Error fetching channel configs:", error);
      res.status(500).json({ message: "Failed to fetch channel configs" });
    }
  });

  app.get("/api/channel-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      res.json(redactChannelConfigSecrets(config));
    } catch (error) {
      console.error("Error fetching channel config:", error);
      res.status(500).json({ message: "Failed to fetch channel config" });
    }
  });

  app.post("/api/channel-configs", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;

      const parsed = insertChannelConfigSchema.safeParse({
        ...req.body,
        organizationId: org.id,
        createdBy: userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const config = await storage.createChannelConfig(parsed.data);
      const redactedConfig = redactChannelConfigSecrets(config);
      broadcast("channel:config:created", redactedConfig);
      res.status(201).json(redactedConfig);
    } catch (error) {
      console.error("Error creating channel config:", error);
      res.status(500).json({ message: "Failed to create channel config" });
    }
  });

  app.patch("/api/channel-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const parsed = updateChannelConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }

      // Storage layer handles merging secrets - preserves password/accessToken if not provided
      const config = await storage.updateChannelConfig(id, parsed.data);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      const redactedConfig = redactChannelConfigSecrets(config);
      broadcast("channel:config:updated", redactedConfig);
      res.json(redactedConfig);
    } catch (error) {
      console.error("Error updating channel config:", error);
      res.status(500).json({ message: "Failed to update channel config" });
    }
  });

  app.delete("/api/channel-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      await storage.deleteChannelConfig(id);
      broadcast("channel:config:deleted", { id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting channel config:", error);
      res.status(500).json({ message: "Failed to delete channel config" });
    }
  });

  app.post("/api/channel-configs/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });

      if (config.type === "email") {
        const emailConfig = config.emailConfig as EmailConfig | undefined;
        if (!emailConfig) {
          return res.status(400).json({ message: "Email configuration is missing" });
        }

        // Test both IMAP and SMTP connections
        const [imapOk, smtpOk] = await Promise.all([
          verifyImapConnection(emailConfig),
          verifySmtpConnection(emailConfig),
        ]);

        if (imapOk && smtpOk) {
          res.json({ success: true, message: "Email configuration validated successfully", imap: true, smtp: true });
        } else {
          res.status(400).json({
            success: false,
            message: "Email configuration validation failed",
            imap: imapOk,
            smtp: smtpOk,
          });
        }
      } else if (config.type === "whatsapp") {
        res.json({ success: true, message: "WhatsApp configuration validated successfully" });
      } else {
        res.status(400).json({ message: "Unknown channel type" });
      }
    } catch (error) {
      console.error("Error testing channel config:", error);
      res.status(500).json({ message: "Failed to test channel config" });
    }
  });

  // ========== EMAIL ROUTES ==========

  // Sync emails from IMAP
  app.post("/api/channel-configs/:id/email/sync", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const async = req.query.async === "true";

      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "email") return res.status(400).json({ message: "Not an email channel" });

      const emailConfig = config.emailConfig as EmailConfig | undefined;
      if (!emailConfig) {
        return res.status(400).json({ message: "Email configuration is missing" });
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

        return res.status(202).json({
          message: "Email sync queued",
          jobId: job.id,
          status: job.status,
        });
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

      res.json({
        success: true,
        newEmails: result.newEmails,
        totalProcessed: result.totalProcessed,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: "Failed to sync emails" });
    }
  });

  // Send email via SMTP
  app.post("/api/channel-configs/:id/email/send", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const { to, cc, bcc, subject, text, html, inReplyTo, references } = req.body;

      if (!to) return res.status(400).json({ message: "Recipient (to) is required" });
      if (!subject) return res.status(400).json({ message: "Subject is required" });
      if (!text && !html) return res.status(400).json({ message: "Either text or html body is required" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "email") return res.status(400).json({ message: "Not an email channel" });

      const emailConfig = config.emailConfig as EmailConfig | undefined;
      if (!emailConfig) {
        return res.status(400).json({ message: "Email configuration is missing" });
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

      res.json({
        success: true,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Connect WhatsApp instance (create and get QR code)
  app.post("/api/channel-configs/:id/whatsapp/connect", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;

      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
      }

      if (process.env.NODE_ENV === "production" && !process.env.EVOLUTION_WEBHOOK_SECRET) {
        return res.status(500).json({
          message: "EVOLUTION_WEBHOOK_SECRET is required in production to validate webhooks",
        });
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

      res.json({
        instanceName,
        qrCode: qrData.base64 || qrData.code,
        pairingCode: qrData.pairingCode,
        status: "qr_pending",
      });
    } catch (error) {
      console.error("Error connecting WhatsApp:", error);
      res.status(500).json({ message: "Failed to connect WhatsApp" });
    }
  });

  // Get WhatsApp connection status
  app.get("/api/channel-configs/:id/whatsapp/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return res.json({
          status: "disconnected",
          instanceName: null,
        });
      }

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
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

        res.json({
          status,
          instanceName,
          lastConnectedAt: whatsappConfig.lastConnectedAt,
        });
      } catch {
        // Instance might not exist or is disconnected
        res.json({
          status: "disconnected",
          instanceName,
        });
      }
    } catch (error) {
      console.error("Error getting WhatsApp status:", error);
      res.status(500).json({ message: "Failed to get WhatsApp status" });
    }
  });

  // Disconnect WhatsApp instance
  app.post("/api/channel-configs/:id/whatsapp/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;

      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return res.json({ success: true, message: "No active connection" });
      }

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
      }

      try {
        await evolutionApi.disconnectInstance(instanceName);
      } catch (error) {
        // Instance might already be disconnected
        console.log("Instance disconnect error (may already be disconnected):", error);
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

      res.json({ success: true, message: "WhatsApp disconnected" });
    } catch (error) {
      console.error("Error disconnecting WhatsApp:", error);
      res.status(500).json({ message: "Failed to disconnect WhatsApp" });
    }
  });

  // Send WhatsApp message via Evolution API
  app.post("/api/channel-configs/:id/whatsapp/send", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const { to, text, mediaUrl, mediaType, caption, fileName } = req.body;

      if (!to) return res.status(400).json({ message: "Recipient phone number (to) is required" });
      if (!text && !mediaUrl) return res.status(400).json({ message: "Either text or mediaUrl is required" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return res.status(400).json({ message: "WhatsApp not connected" });
      }

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
      }

      let result;
      if (mediaUrl && mediaType) {
        result = await evolutionApi.sendMediaMessage(instanceName, to, mediaUrl, mediaType, caption, fileName);
      } else {
        result = await evolutionApi.sendTextMessage(instanceName, to, text);
      }

      res.json({ success: true, result });
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ message: "Failed to send WhatsApp message" });
    }
  });
}
