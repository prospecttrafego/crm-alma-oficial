import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { logger } from "../logger";

export function registerPushTokenRoutes(app: Express) {
  /**
   * Register or update a push token
   * POST /api/push-tokens
   * Body: { token: string, deviceInfo?: string, oldToken?: string }
   *
   * If oldToken is provided, it will be deleted and replaced with the new token
   * This handles token refresh scenarios
   */
  app.post("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { token, deviceInfo, oldToken } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // If an old token was provided, delete it first (token refresh scenario)
      if (oldToken && oldToken !== token) {
        try {
          await storage.deletePushToken(oldToken);
          logger.info("[FCM] Deleted old token during refresh", { userId });
        } catch {
          // Old token might not exist, that's fine
        }
      }

      const pushToken = await storage.createPushToken({
        userId,
        token,
        deviceInfo: deviceInfo || null,
      });

      logger.info("[FCM] Push token registered", { userId, hasDeviceInfo: !!deviceInfo });
      res.status(201).json(pushToken);
    } catch (error) {
      console.error("Error saving push token:", error);
      res.status(500).json({ message: "Failed to save push token" });
    }
  });

  /**
   * Get all push tokens for the current user
   * GET /api/push-tokens
   */
  app.get("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const tokens = await storage.getPushTokensForUser(userId);

      // Don't return the actual token values, just metadata
      const safeTokens = tokens.map((t) => ({
        id: t.id,
        deviceInfo: t.deviceInfo,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
      }));

      res.json(safeTokens);
    } catch (error) {
      console.error("Error fetching push tokens:", error);
      res.status(500).json({ message: "Failed to fetch push tokens" });
    }
  });

  /**
   * Delete a push token
   * DELETE /api/push-tokens
   * Body: { token: string }
   */
  app.delete("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      await storage.deletePushToken(token);
      logger.info("[FCM] Push token deleted");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting push token:", error);
      res.status(500).json({ message: "Failed to delete push token" });
    }
  });

  /**
   * Delete all push tokens for the current user (logout from all devices)
   * DELETE /api/push-tokens/all
   */
  app.delete("/api/push-tokens/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.deletePushTokensForUser(userId);
      logger.info("[FCM] All push tokens deleted for user", { userId });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting all push tokens:", error);
      res.status(500).json({ message: "Failed to delete push tokens" });
    }
  });
}

