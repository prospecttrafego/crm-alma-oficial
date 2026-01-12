/**
 * Push Tokens API
 */

import { api } from "./index";
import type { CreatePushTokenDTO } from "@shared/types";

export const pushTokensApi = {
  register: (data: CreatePushTokenDTO) => api.post<void>("/api/push-tokens", data),
};
