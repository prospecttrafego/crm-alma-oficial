/**
 * Saved Views API - CRUD operations for saved views
 */

import { api } from './index';
import type { SavedView } from '@shared/schema';
import type { CreateSavedViewDTO, UpdateSavedViewDTO } from '@shared/types';

export const savedViewsApi = {
  /**
   * List all saved views
   */
  list: () => api.get<SavedView[]>('/api/saved-views'),

  /**
   * List saved views by type
   */
  listByType: (type: string) =>
    api.get<SavedView[]>(`/api/saved-views?type=${encodeURIComponent(type)}`),

  /**
   * Get a single saved view by ID
   */
  get: (id: number) => api.get<SavedView>(`/api/saved-views/${id}`),

  /**
   * Create a new saved view
   */
  create: (data: CreateSavedViewDTO) =>
    api.post<SavedView>('/api/saved-views', data),

  /**
   * Update an existing saved view
   */
  update: (id: number, data: UpdateSavedViewDTO) =>
    api.patch<SavedView>(`/api/saved-views/${id}`, data),

  /**
   * Delete a saved view
   */
  delete: (id: number) => api.delete<void>(`/api/saved-views/${id}`),

  /**
   * Set a saved view as default for its type
   */
  setDefault: (id: number) =>
    api.patch<SavedView>(`/api/saved-views/${id}`, { isDefault: true }),
};
