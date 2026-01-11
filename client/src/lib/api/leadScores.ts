/**
 * Lead Scores API
 */

import { api } from "./index";
import type { LeadScore } from "@shared/schema";

export const leadScoresApi = {
  get: (entityType: string, entityId: number) =>
    api.get<LeadScore>(`/api/lead-scores/${entityType}/${entityId}`),

  calculate: (entityType: string, entityId: number) =>
    api.post<LeadScore>(`/api/lead-scores/${entityType}/${entityId}/calculate`, {}),
};
