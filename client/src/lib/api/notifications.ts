/**
 * Notifications API
 */

import { api } from "./index";
import { notificationSchema, unreadCountSchema, successFlagSchema } from "@shared/apiSchemas";
import type { Notification } from "@shared/schema";
import { z } from "zod";

export const notificationsApi = {
  list: () => api.get<Notification[]>("/api/notifications", z.array(notificationSchema)),

  unreadCount: () => api.get<{ count: number }>("/api/notifications/unread-count", unreadCountSchema),

  markRead: (id: number) => api.patch<Notification>(`/api/notifications/${id}/read`, {}, notificationSchema),

  markAllRead: () => api.post<{ success: boolean }>("/api/notifications/mark-all-read", {}, successFlagSchema),
};
