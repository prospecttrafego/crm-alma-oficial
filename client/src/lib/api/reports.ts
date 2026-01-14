/**
 * Reports API
 */

import { api } from "./index";
import { reportDataSchema } from "@shared/apiSchemas";
import type { ReportData } from "@shared/types";

export type ReportsQuery = {
  startDate: string;
  endDate: string;
};

export const reportsApi = {
  get: (params: ReportsQuery) => {
    const search = new URLSearchParams(params);
    return api.get<ReportData>(`/api/reports?${search.toString()}`, reportDataSchema);
  },
};
