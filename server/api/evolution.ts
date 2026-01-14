import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";
import { evolutionApi } from "../integrations/evolution/api";
import { evolutionHandler, type EvolutionWebhookEvent } from "../integrations/evolution/handler";
import { whatsappLogger } from "../logger";
import { asyncHandler } from "../middleware";
import { sendSuccess } from "../response";

export function registerEvolutionRoutes(app: Express) {
  // Check if Evolution API is configured
  app.get(
    "/api/evolution/status",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const config = evolutionApi.getConfiguration();
      sendSuccess(res, {
        configured: config.configured,
        url: config.configured ? config.url : null,
      });
    })
  );

  // Evolution API Webhook (receives messages from WhatsApp)
  // Note: This endpoint does NOT require authentication as it's called by Evolution API
  app.post("/api/webhooks/evolution", async (req, res) => {
    try {
      const expectedToken = process.env.EVOLUTION_WEBHOOK_SECRET;
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

      // In production, EVOLUTION_WEBHOOK_SECRET is REQUIRED
      if (process.env.NODE_ENV === "production" && !expectedToken) {
        whatsappLogger.error("[Evolution Webhook] EVOLUTION_WEBHOOK_SECRET is not configured in production. Rejecting all webhooks.", { ip: clientIp });
        return res.status(401).json({ error: "Webhook secret not configured" });
      }

      // Validate token if configured
      if (expectedToken) {
        const providedToken =
          (req.query?.token as string | undefined) ||
          (req.headers["x-evolution-webhook-secret"] as string | undefined);
        if (!providedToken || providedToken !== expectedToken) {
          whatsappLogger.warn("[Evolution Webhook] Invalid or missing token", { ip: clientIp, hasToken: !!providedToken });
          return res.status(401).json({ error: "Unauthorized" });
        }
      }

      const event = req.body as EvolutionWebhookEvent;

      const normalizedEvent = String(event.event || "")
        .toUpperCase()
        .replace(/\./g, "_");
      whatsappLogger.info(`[Evolution Webhook] Received: ${normalizedEvent} for instance: ${event.instance}`);

      // Parse instance name to get channel config ID.
      // Known formats:
      // - {prefix}-crm-org-{orgId}-channel-{configId}
      // - crm-org-{orgId}-channel-{configId}
      // - {prefix}-crm-channel-{configId}
      // - crm-channel-{configId}
      const channelMatch = event.instance?.match(/(?:^|-)crm-(?:org-\d+-)?channel-(\d+)$/);
      if (!channelMatch) {
        whatsappLogger.info("[Evolution Webhook] Unknown instance format", { instance: event.instance });
        return res.status(200).json({ received: true });
      }

      const channelConfigId = parseInt(channelMatch[1]);
      if (Number.isNaN(channelConfigId)) {
        return res.status(200).json({ received: true });
      }

      const config = await storage.getChannelConfig(channelConfigId);
      if (!config || config.type !== "whatsapp") {
        whatsappLogger.info("[Evolution Webhook] Channel config not found", { channelConfigId });
        return res.status(200).json({ received: true });
      }

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const expectedInstanceName = whatsappConfig.instanceName as string | undefined;
      if (!expectedInstanceName || expectedInstanceName !== event.instance) {
        whatsappLogger.info("[Evolution Webhook] Instance mismatch for channel", { channelConfigId, expected: expectedInstanceName, received: event.instance });
        return res.status(200).json({ received: true });
      }

      const organizationId = config.organizationId;

      // Set broadcast function for real-time updates
      evolutionHandler.setBroadcast((orgId, eventType, data) => {
        broadcast(`whatsapp:${eventType}`, { organizationId: orgId, data });
      });

      // Process the webhook event
      await evolutionHandler.handleWebhook({ ...event, event: normalizedEvent }, channelConfigId, organizationId);

      res.status(200).json({ received: true });
    } catch (error) {
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      whatsappLogger.error("[Evolution Webhook] Error processing webhook", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ip: clientIp,
      });
      // Return 500 to allow Evolution API to retry
      // Note: Evolution API has built-in retry logic, so returning 500 is the correct behavior
      res.status(500).json({ error: "Processing failed" });
    }
  });
}
