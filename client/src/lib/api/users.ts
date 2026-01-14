/**
 * Users API
 */

import { api } from "./index";
import { safeUserSchema } from "@shared/apiSchemas";
import type { SafeUser } from "@shared/types";
import type { UpdateUserProfileDTO } from "@shared/types";
import { z } from "zod";

export const usersApi = {
  me: () => api.get<SafeUser>("/api/auth/me", safeUserSchema),

  list: () => api.get<SafeUser[]>("/api/users", z.array(safeUserSchema)),

  updateMe: (data: UpdateUserProfileDTO) =>
    api.patch<SafeUser>("/api/users/me", data, safeUserSchema),
};
