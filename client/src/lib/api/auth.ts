/**
 * Auth API
 */

import { api } from "./client";
import { safeUserSchema, messageResponseSchema } from "@shared/apiSchemas";
import type { SafeUser } from "@shared/types";

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
  logout: () => api.post<{ message: string }>("/api/logout", {}, messageResponseSchema),
};
