/**
 * Email Templates API - CRUD operations for email templates
 */

import { api } from './index';
import type { EmailTemplate } from '@shared/schema';
import type { CreateEmailTemplateDTO, UpdateEmailTemplateDTO } from '@shared/types';

export const emailTemplatesApi = {
  /**
   * List all email templates
   */
  list: () => api.get<EmailTemplate[]>('/api/email-templates'),

  /**
   * Get a single email template by ID
   */
  get: (id: number) => api.get<EmailTemplate>(`/api/email-templates/${id}`),

  /**
   * Create a new email template
   */
  create: (data: CreateEmailTemplateDTO) =>
    api.post<EmailTemplate>('/api/email-templates', data),

  /**
   * Update an existing email template
   */
  update: (id: number, data: UpdateEmailTemplateDTO) =>
    api.patch<EmailTemplate>(`/api/email-templates/${id}`, data),

  /**
   * Delete an email template
   */
  delete: (id: number) => api.delete<void>(`/api/email-templates/${id}`),
};
