/**
 * Users API
 */

import { api } from "./index";
import type { User } from "@shared/schema";

export type UpdateUserProfilePayload = {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string | null;
  preferences?: {
    language?: "pt-BR" | "en";
  };
};

export const usersApi = {
  me: () => api.get<User>("/api/auth/me"),

  list: () => api.get<User[]>("/api/users"),

  updateMe: (data: UpdateUserProfilePayload) =>
    api.patch<User>("/api/users/me", data),
};
