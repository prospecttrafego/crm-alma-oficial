/**
 * Companies API - CRUD operations for companies
 */

import { api } from './index';
import type { Company } from '@shared/schema';
import type { CreateCompanyDTO, UpdateCompanyDTO } from '@shared/types';

export const companiesApi = {
  /**
   * List all companies
   */
  list: () => api.get<Company[]>('/api/companies'),

  /**
   * Get a single company by ID
   */
  get: (id: number) => api.get<Company>(`/api/companies/${id}`),

  /**
   * Create a new company
   */
  create: (data: CreateCompanyDTO) => api.post<Company>('/api/companies', data),

  /**
   * Update an existing company
   */
  update: (id: number, data: UpdateCompanyDTO) =>
    api.patch<Company>(`/api/companies/${id}`, data),

  /**
   * Delete a company
   */
  delete: (id: number) => api.delete<void>(`/api/companies/${id}`),
};
