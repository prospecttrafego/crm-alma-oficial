/**
 * Auth API
 */

import { api } from "./index";
import type { User } from "@shared/schema";

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
  login: (data: LoginPayload) => api.post<User>("/api/login", data),
  register: (data: RegisterPayload) => api.post<User>("/api/register", data),
  logout: () => api.post<{ message: string }>("/api/logout", {}),
};
