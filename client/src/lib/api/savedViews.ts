/**
 * Saved Views API - CRUD operations for saved views
 */

import { api } from "./client";
import { savedViewSchema } from "@shared/apiSchemas";
import type { SavedView } from '@shared/schema';
import type { CreateSavedViewDTO } from '@shared/types';
import { z } from "zod";

export const savedViewsApi = {
  /**
   * List saved views by type
   */
  listByType: (type: string) =>
    api.get<SavedView[]>(`/api/saved-views?type=${encodeURIComponent(type)}`, z.array(savedViewSchema)),

  /**
   * Create a new saved view
   */
  create: (data: CreateSavedViewDTO) =>
    api.post<SavedView>('/api/saved-views', data, savedViewSchema),

  /**
   * Delete a saved view
   */
  delete: (id: number) => api.delete<void>(`/api/saved-views/${id}`),
};
