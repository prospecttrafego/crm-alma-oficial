/**
 * Calendar Events API - CRUD operations for calendar events
 */

import { api } from './index';
import type { CalendarEvent } from '@shared/schema';
import type { CreateCalendarEventDTO, UpdateCalendarEventDTO } from '@shared/types';

export const calendarEventsApi = {
  /**
   * List all calendar events
   */
  list: () => api.get<CalendarEvent[]>('/api/calendar-events'),

  /**
   * Get events in a date range
   */
  listByRange: (start: Date, end: Date) => {
    const params = new URLSearchParams();
    params.set('startDate', start.toISOString());
    params.set('endDate', end.toISOString());
    return api.get<CalendarEvent[]>(`/api/calendar-events?${params.toString()}`);
  },

  /**
   * Get a single calendar event by ID
   */
  get: (id: number) => api.get<CalendarEvent>(`/api/calendar-events/${id}`),

  /**
   * Create a new calendar event
   */
  create: (data: CreateCalendarEventDTO) =>
    api.post<CalendarEvent>('/api/calendar-events', data),

  /**
   * Update an existing calendar event
   */
  update: (id: number, data: UpdateCalendarEventDTO) =>
    api.patch<CalendarEvent>(`/api/calendar-events/${id}`, data),

  /**
   * Delete a calendar event
   */
  delete: (id: number) => api.delete<void>(`/api/calendar-events/${id}`),
};
