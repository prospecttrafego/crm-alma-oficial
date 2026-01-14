/**
 * Activities API - CRUD operations for activities
 */

import { api } from './index';
import { activitySchema } from "@shared/apiSchemas";
import type { Activity } from '@shared/schema';
import type { CreateActivityDTO, UpdateActivityDTO } from '@shared/types';
import { z } from "zod";

export const activitiesApi = {
  /**
   * List all activities
   */
  list: () => api.get<Activity[]>('/api/activities', z.array(activitySchema)),

  /**
   * Get activities for a contact
   */
  listByContact: (contactId: number) =>
    api.get<Activity[]>(`/api/contacts/${contactId}/activities`, z.array(activitySchema)),

  /**
   * Create a new activity
   */
  create: (data: CreateActivityDTO) => api.post<Activity>('/api/activities', data, activitySchema),

  /**
   * Update an existing activity
   */
  update: (id: number, data: UpdateActivityDTO) =>
    api.patch<Activity>(`/api/activities/${id}`, data, activitySchema),

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
    }, activitySchema),
};
