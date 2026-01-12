/**
 * Activities API - CRUD operations for activities
 */

import { api } from './index';
import type { Activity } from '@shared/schema';
import type { CreateActivityDTO, UpdateActivityDTO } from '@shared/types';

export const activitiesApi = {
  /**
   * List all activities
   */
  list: () => api.get<Activity[]>('/api/activities'),

  /**
   * Get activities for a contact
   */
  listByContact: (contactId: number) =>
    api.get<Activity[]>(`/api/contacts/${contactId}/activities`),

  /**
   * Create a new activity
   */
  create: (data: CreateActivityDTO) => api.post<Activity>('/api/activities', data),

  /**
   * Update an existing activity
   */
  update: (id: number, data: UpdateActivityDTO) =>
    api.patch<Activity>(`/api/activities/${id}`, data),

  /**
   * Delete an activity
   */
  delete: (id: number) => api.delete<void>(`/api/activities/${id}`),

  /**
   * Mark activity as completed
   */
  complete: (id: number) =>
    api.patch<Activity>(`/api/activities/${id}`, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    }),
};
