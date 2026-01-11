/**
 * Push Tokens API
 */

import { api } from "./index";
import type { CreatePushTokenDTO, DeletePushTokenDTO } from "@shared/types";

export const pushTokensApi = {
  register: (data: CreatePushTokenDTO) => api.post<void>("/api/push-tokens", data),
  unregister: (data: DeletePushTokenDTO) => api.delete<void>("/api/push-tokens", data),
  unregisterAll: () => api.delete<void>("/api/push-tokens/all"),
};
