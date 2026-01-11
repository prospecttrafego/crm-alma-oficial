/**
 * API Client - Type-safe HTTP client for backend communication
 */

import type { ApiError } from '@shared/types';

/**
 * Custom error class for API request failures
 * Provides structured error information from the backend
 */
export class ApiRequestError extends Error {
  constructor(
    public readonly error: ApiError,
    public readonly status: number
  ) {
    super(error.message);
    this.name = 'ApiRequestError';
  }

  get code() {
    return this.error.code;
  }

  get details() {
    return this.error.details;
  }

  isValidationError() {
    return this.code === 'VALIDATION_ERROR';
  }

  isNotFound() {
    return this.code === 'NOT_FOUND';
  }

  isUnauthorized() {
    return this.code === 'UNAUTHORIZED';
  }

  isForbidden() {
    return this.code === 'FORBIDDEN';
  }

  isConflict() {
    return this.code === 'CONFLICT';
  }
}

/**
 * Type-safe API client for making HTTP requests
 */
export class ApiClient {
  private baseUrl = '';

  /**
   * Make an HTTP request to the backend
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown
  ): Promise<T> {
    const response = await fetch(this.baseUrl + url, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    });

    let json: any = null;
    if (response.status !== 204) {
      try {
        json = await response.json();
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      throw new ApiRequestError(
        json.error || {
          code: 'UNKNOWN_ERROR',
          message: json.message || 'Erro desconhecido',
        },
        response.status
      );
    }

    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return json.data as T;
    }

    return json as T;
  }

  /**
   * GET request
   */
  get<T>(url: string) {
    return this.request<T>('GET', url);
  }

  /**
   * POST request
   */
  post<T>(url: string, data: unknown) {
    return this.request<T>('POST', url, data);
  }

  /**
   * PATCH request
   */
  patch<T>(url: string, data: unknown) {
    return this.request<T>('PATCH', url, data);
  }

  /**
   * PUT request
   */
  put<T>(url: string, data: unknown) {
    return this.request<T>('PUT', url, data);
  }

  /**
   * DELETE request
   */
  delete<T>(url: string, data?: unknown) {
    return this.request<T>('DELETE', url, data);
  }
}

// Singleton instance
export const api = new ApiClient();

// Re-export domain APIs
export { contactsApi } from './contacts';
export { dealsApi } from './deals';
export { pipelinesApi } from './pipelines';
export { activitiesApi } from './activities';
export { conversationsApi } from './conversations';
export { calendarEventsApi } from './calendarEvents';
export { channelConfigsApi } from './channelConfigs';
export { emailTemplatesApi } from './emailTemplates';
export { savedViewsApi } from './savedViews';
export { authApi } from './auth';
export { filesApi } from './files';
export { leadScoresApi } from './leadScores';
export { notificationsApi } from './notifications';
export { pushTokensApi } from './pushTokens';
export { usersApi } from './users';
export { reportsApi } from './reports';
