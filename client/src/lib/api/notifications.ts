/**
 * Notifications API
 */

import { api } from "./index";
import type { Notification } from "@shared/schema";

export const notificationsApi = {
  list: () => api.get<Notification[]>("/api/notifications"),

  unreadCount: () => api.get<{ count: number }>("/api/notifications/unread-count"),

  markRead: (id: number) => api.patch<Notification>(`/api/notifications/${id}/read`, {}),

  markAllRead: () => api.post<{ success: true }>("/api/notifications/mark-all-read", {}),
};
