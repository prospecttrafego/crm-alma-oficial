import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler, validateParams, getCurrentUser } from "../middleware";
import { sendSuccess, sendNotFound } from "../response";

// Schemas de validacao
const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerNotificationRoutes(app: Express) {
  // Get notifications for current user
  app.get(
    "/api/notifications",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const notificationsList = await storage.getNotifications(currentUser!.id);
      sendSuccess(res, notificationsList);
    })
  );

  // Get unread notification count
  app.get(
    "/api/notifications/unread-count",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const count = await storage.getUnreadNotificationCount(currentUser!.id);
      sendSuccess(res, { count });
    })
  );

  // Mark notification as read
  app.patch(
    "/api/notifications/:id/read",
    isAuthenticated,
    validateParams(notificationIdParamSchema),
    asyncHandler(async (req: any, res) => {
      const currentUser = getCurrentUser(req);
      const { id } = req.validatedParams;

      const notification = await storage.markNotificationRead(id, currentUser!.id);
      if (!notification) {
        return sendNotFound(res, "Notification not found");
      }

      sendSuccess(res, notification);
    })
  );

  // Mark all notifications as read
  app.post(
    "/api/notifications/mark-all-read",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      await storage.markAllNotificationsRead(currentUser!.id);
      sendSuccess(res, { success: true });
    })
  );
}
