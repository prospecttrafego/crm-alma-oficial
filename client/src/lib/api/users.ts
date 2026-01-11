/**
 * Users API
 */

import { api } from "./index";
import type { User } from "@shared/schema";
import type { UpdateUserProfileDTO } from "@shared/types";

export const usersApi = {
  me: () => api.get<User>("/api/auth/me"),

  list: () => api.get<User[]>("/api/users"),

  updateMe: (data: UpdateUserProfileDTO) =>
    api.patch<User>("/api/users/me", data),
};
