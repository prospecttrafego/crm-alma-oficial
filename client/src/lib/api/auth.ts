/**
 * Auth API
 */

import { api } from "./client";
import { safeUserSchema, messageResponseSchema } from "@shared/apiSchemas";
import type { SafeUser } from "@shared/types";
import { pushTokensApi } from "./pushTokens";
import { clearOfflineMessages } from "@/lib/offlineDb";
import { clearStoredFcmToken, getStoredFcmToken } from "@/lib/firebase";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export const authApi = {
  login: (data: LoginPayload) => api.post<SafeUser>("/api/login", data, safeUserSchema),
  register: (data: RegisterPayload) =>
    api.post<SafeUser>("/api/register", data, safeUserSchema),
  logout: async () => {
    const token = getStoredFcmToken();

    if (token) {
      try {
        await pushTokensApi.unregister(token);
      } catch {
        // Best-effort cleanup
      }
    }

    try {
      return await api.post<{ message: string }>("/api/logout", {}, messageResponseSchema);
    } finally {
      try {
        await clearOfflineMessages();
      } catch {
        // Best-effort cleanup
      }
      clearStoredFcmToken();
    }
  },
};
