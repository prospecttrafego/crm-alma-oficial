/**
 * WhatsApp Configuration Service
 * Handles WhatsApp integration operations via Evolution API
 */

import { evolutionApi } from "../integrations/evolution/api";
import { storage } from "../storage";
import { logger } from "../logger";
import type { ChannelConfig } from "@shared/schema";

export interface WhatsAppConnectionResult {
  instanceName: string;
  qrCode?: string;
  pairingCode?: string;
  status: string;
}

export interface WhatsAppStatusResult {
  status: string;
  instanceName: string | null;
  lastConnectedAt?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  result: unknown;
}

/**
 * Build the instance name from organization and channel config IDs
 */
export function buildInstanceName(organizationId: number, channelConfigId: number): string {
  const baseInstanceName = `crm-org-${organizationId}-channel-${channelConfigId}`;
  const rawInstancePrefix = process.env.EVOLUTION_INSTANCE_PREFIX?.trim();
  const instancePrefix = rawInstancePrefix ? rawInstancePrefix.replace(/-+$/, "") : undefined;
  return instancePrefix ? `${instancePrefix}-${baseInstanceName}` : baseInstanceName;
}

/**
 * Connect WhatsApp instance and get QR code for pairing
 */
export async function connectWhatsApp(
  config: ChannelConfig,
  userId: string
): Promise<WhatsAppConnectionResult> {
  if (!evolutionApi.isConfigured()) {
    throw new Error("Evolution API is not configured");
  }

  if (process.env.NODE_ENV === "production" && !process.env.EVOLUTION_WEBHOOK_SECRET) {
    throw new Error("EVOLUTION_WEBHOOK_SECRET is required in production to validate webhooks");
  }

  const organizationId = config.organizationId;
  const instanceName = buildInstanceName(organizationId, config.id);

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

  await storage.updateChannelConfig(config.id, {
    whatsappConfig: whatsappConfig as ChannelConfig["whatsappConfig"],
  });

  // Audit log for WhatsApp connection initiated
  await storage.createAuditLog({
    userId,
    action: "create",
    entityType: "integration",
    entityId: config.id,
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

  return {
    instanceName,
    qrCode: qrData.base64 || qrData.code,
    pairingCode: qrData.pairingCode,
    status: "qr_pending",
  };
}

/**
 * Get WhatsApp connection status
 */
export async function getWhatsAppStatus(config: ChannelConfig): Promise<WhatsAppStatusResult> {
  const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
  const instanceName = whatsappConfig.instanceName as string | undefined;

  if (!instanceName) {
    return {
      status: "disconnected",
      instanceName: null,
    };
  }

  if (!evolutionApi.isConfigured()) {
    throw new Error("Evolution API is not configured");
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
      await storage.updateChannelConfig(config.id, {
        whatsappConfig: whatsappConfig as ChannelConfig["whatsappConfig"],
      });
    }

    return {
      status,
      instanceName,
      lastConnectedAt: whatsappConfig.lastConnectedAt as string | undefined,
    };
  } catch {
    // Instance might not exist or is disconnected
    return {
      status: "disconnected",
      instanceName,
    };
  }
}

/**
 * Disconnect WhatsApp instance
 */
export async function disconnectWhatsApp(
  config: ChannelConfig,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
  const instanceName = whatsappConfig.instanceName as string | undefined;

  if (!instanceName) {
    return { success: true, message: "No active connection" };
  }

  if (!evolutionApi.isConfigured()) {
    throw new Error("Evolution API is not configured");
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

  await storage.updateChannelConfig(config.id, {
    whatsappConfig: whatsappConfig as ChannelConfig["whatsappConfig"],
  });

  // Audit log for WhatsApp disconnection
  await storage.createAuditLog({
    userId,
    action: "delete",
    entityType: "integration",
    entityId: config.id,
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

  return { success: true, message: "WhatsApp disconnected" };
}

/**
 * Send WhatsApp message (text or media)
 */
export async function sendWhatsAppMessage(
  config: ChannelConfig,
  to: string,
  options: {
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    fileName?: string;
  }
): Promise<WhatsAppSendResult> {
  const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
  const instanceName = whatsappConfig.instanceName as string | undefined;

  if (!instanceName) {
    throw new Error("WhatsApp not connected");
  }

  if (!evolutionApi.isConfigured()) {
    throw new Error("Evolution API is not configured");
  }

  let result;
  if (options.mediaUrl && options.mediaType) {
    const validMediaTypes = ["image", "video", "audio", "document"] as const;
    const mediaType = validMediaTypes.includes(options.mediaType as typeof validMediaTypes[number])
      ? (options.mediaType as typeof validMediaTypes[number])
      : "document";
    result = await evolutionApi.sendMediaMessage(
      instanceName,
      to,
      options.mediaUrl,
      mediaType,
      options.caption,
      options.fileName
    );
  } else if (options.text) {
    result = await evolutionApi.sendTextMessage(instanceName, to, options.text);
  } else {
    throw new Error("Either text or mediaUrl is required");
  }

  return { success: true, result };
}
