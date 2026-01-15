import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { logger } from "../logger";
import { asyncHandler, validateBody, getCurrentUser } from "../middleware";
import { createPushTokenSchema, deletePushTokenSchema } from "../validation";
import { sendSuccess } from "../response";

export function registerPushTokenRoutes(app: Express) {
  /**
   * Register or update a push token
   * POST /api/push-tokens
   * Body: { token: string, deviceInfo?: string, oldToken?: string }
   */
  app.post(
    "/api/push-tokens",
    isAuthenticated,
    validateBody(createPushTokenSchema),
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const { token, deviceInfo, oldToken } = req.validatedBody;

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
      sendSuccess(res, pushToken, 201);
    })
  );

  /**
   * Get all push tokens for the current user
   * GET /api/push-tokens
   */
  app.get(
    "/api/push-tokens",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const tokens = await storage.getPushTokensForUser(userId);

      // Don't return the actual token values, just metadata
      const safeTokens = tokens.map((t) => ({
        id: t.id,
        deviceInfo: t.deviceInfo,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
      }));

      sendSuccess(res, safeTokens);
    })
  );

  /**
   * Delete a push token
   * DELETE /api/push-tokens
   * Body: { token: string }
   */
  app.delete(
    "/api/push-tokens",
    isAuthenticated,
    validateBody(deletePushTokenSchema),
    asyncHandler(async (req, res) => {
      const { token } = req.validatedBody;
      await storage.deletePushToken(token);
      logger.info("[FCM] Push token deleted");
      res.status(204).send();
    })
  );

  /**
   * Delete all push tokens for the current user (logout from all devices)
   * DELETE /api/push-tokens/all
   */
  app.delete(
    "/api/push-tokens/all",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      await storage.deletePushTokensForUser(userId);
      logger.info("[FCM] All push tokens deleted for user", { userId });
      res.status(204).send();
    })
  );
}
