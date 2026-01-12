/**
 * Saved Views API - CRUD operations for saved views
 */

import { api } from './index';
import type { SavedView } from '@shared/schema';
import type { CreateSavedViewDTO } from '@shared/types';

export const savedViewsApi = {
  /**
   * List saved views by type
   */
  listByType: (type: string) =>
    api.get<SavedView[]>(`/api/saved-views?type=${encodeURIComponent(type)}`),

  /**
   * Create a new saved view
   */
  create: (data: CreateSavedViewDTO) =>
    api.post<SavedView>('/api/saved-views', data),

  /**
   * Delete a saved view
   */
  delete: (id: number) => api.delete<void>(`/api/saved-views/${id}`),
};
