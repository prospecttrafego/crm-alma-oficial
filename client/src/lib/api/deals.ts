/**
 * Deals API - CRUD operations for deals
 */

import { api } from './index';
import type { Deal } from '@shared/schema';
import type { CreateDealDTO, UpdateDealDTO, MoveDealDTO } from '@shared/types';

export const dealsApi = {
  /**
   * List all deals
   */
  list: () => api.get<Deal[]>('/api/deals'),

  /**
   * Get a single deal by ID
   */
  get: (id: number) => api.get<Deal>(`/api/deals/${id}`),

  /**
   * Create a new deal
   */
  create: (data: CreateDealDTO) => api.post<Deal>('/api/deals', data),

  /**
   * Update an existing deal
   */
  update: (id: number, data: UpdateDealDTO) =>
    api.patch<Deal>(`/api/deals/${id}`, data),

  /**
   * Delete a deal
   */
  delete: (id: number) => api.delete<void>(`/api/deals/${id}`),

  /**
   * Move a deal to a different stage
   */
  move: (id: number, data: MoveDealDTO) =>
    api.patch<Deal>(`/api/deals/${id}/stage`, data),
};
