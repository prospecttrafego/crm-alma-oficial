/**
 * Lead Scores API
 */

import { api } from "./index";
import { leadScoreSchema } from "@shared/apiSchemas";
import type { LeadScore } from "@shared/schema";

export const leadScoresApi = {
  get: (entityType: string, entityId: number) =>
    api.get<LeadScore | null>(`/api/lead-scores/${entityType}/${entityId}`, leadScoreSchema.nullable()),

  calculate: (entityType: string, entityId: number) =>
    api.post<LeadScore>(`/api/lead-scores/${entityType}/${entityId}/calculate`, {}, leadScoreSchema),
};
