/**
 * Push Tokens API
 */

import { api } from "./index";

export const pushTokensApi = {
  register: (token: string) => api.post<void>("/api/push-tokens", { token }),
  unregister: (token: string) => api.delete<void>("/api/push-tokens", { token }),
  unregisterAll: () => api.delete<void>("/api/push-tokens/all"),
};
