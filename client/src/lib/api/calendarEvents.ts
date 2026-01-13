/**
 * Calendar Events API - CRUD operations for calendar events
 */

import { api } from './index';
import {
  calendarEventSchema,
  googleCalendarAuthSchema,
  googleCalendarConfiguredSchema,
  googleCalendarStatusSchema,
  googleCalendarSyncResultSchema,
  successFlagSchema,
} from "@shared/apiSchemas";
import type { CalendarEvent } from '@shared/schema';
import type {
  CreateCalendarEventDTO,
  UpdateCalendarEventDTO,
  GoogleCalendarConfigured,
  GoogleCalendarStatus,
  GoogleCalendarAuth,
  GoogleCalendarSyncResult,
} from '@shared/types';
import { z } from "zod";

export type {
  GoogleCalendarConfigured,
  GoogleCalendarStatus,
  GoogleCalendarAuth,
  GoogleCalendarSyncResult,
} from '@shared/types';

export const calendarEventsApi = {
  /**
   * Get events in a date range
   */
  listByRange: (start: Date, end: Date) => {
    const params = new URLSearchParams();
    params.set('startDate', start.toISOString());
    params.set('endDate', end.toISOString());
    return api.get<CalendarEvent[]>(`/api/calendar-events?${params.toString()}`, z.array(calendarEventSchema));
  },

  /**
   * Create a new calendar event
   */
  create: (data: CreateCalendarEventDTO) =>
    api.post<CalendarEvent>('/api/calendar-events', data, calendarEventSchema),

  /**
   * Update an existing calendar event
   */
  update: (id: number, data: UpdateCalendarEventDTO) =>
    api.patch<CalendarEvent>(`/api/calendar-events/${id}`, data, calendarEventSchema),

  /**
   * Delete a calendar event
   */
  delete: (id: number) => api.delete<void>(`/api/calendar-events/${id}`),

  // ===== GOOGLE CALENDAR INTEGRATION =====

  getGoogleCalendarConfigured: () =>
    api.get<GoogleCalendarConfigured>('/api/integrations/google-calendar/configured', googleCalendarConfiguredSchema),

  getGoogleCalendarStatus: () =>
    api.get<GoogleCalendarStatus>('/api/integrations/google-calendar/status', googleCalendarStatusSchema),

  authorizeGoogleCalendar: () =>
    api.get<GoogleCalendarAuth>('/api/auth/google/authorize', googleCalendarAuthSchema),

  syncGoogleCalendar: () =>
    api.post<GoogleCalendarSyncResult>('/api/integrations/google-calendar/sync', {}, googleCalendarSyncResultSchema),

  disconnectGoogleCalendar: () =>
    api.post<{ success: boolean }>('/api/integrations/google-calendar/disconnect', {}, successFlagSchema),
};
