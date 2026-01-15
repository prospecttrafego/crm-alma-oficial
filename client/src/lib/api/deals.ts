/**
 * Deals API - CRUD operations for deals
 */

import { api } from "./client";
import { dealSchema } from "@shared/apiSchemas";
import type { Deal } from '@shared/schema';
import type { CreateDealDTO, UpdateDealDTO, MoveDealDTO } from '@shared/types';
import { z } from "zod";

export const dealsApi = {
  /**
   * List all deals
   */
  list: () => api.get<Deal[]>('/api/deals', z.array(dealSchema)),

  /**
   * Create a new deal
   */
  create: (data: CreateDealDTO) => api.post<Deal>('/api/deals', data, dealSchema),

  /**
   * Update an existing deal
   */
  update: (id: number, data: UpdateDealDTO) =>
    api.patch<Deal>(`/api/deals/${id}`, data, dealSchema),

  /**
   * Delete a deal
   */
  delete: (id: number) => api.delete<void>(`/api/deals/${id}`),

  /**
   * Move a deal to a different stage
   */
  move: (id: number, data: MoveDealDTO) =>
    api.patch<Deal>(`/api/deals/${id}/stage`, data, dealSchema),
};
