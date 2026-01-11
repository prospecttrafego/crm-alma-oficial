/**
 * Reports API
 */

import { api } from "./index";

export type ReportsQuery = {
  startDate: string;
  endDate: string;
};

export const reportsApi = {
  get: <T>(params: ReportsQuery) => {
    const search = new URLSearchParams(params);
    return api.get<T>(`/api/reports?${search.toString()}`);
  },
};
