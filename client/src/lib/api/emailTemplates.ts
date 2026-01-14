/**
 * Email Templates API - CRUD operations for email templates
 */

import { api } from './index';
import { emailTemplateSchema } from "@shared/apiSchemas";
import type { EmailTemplate } from '@shared/schema';
import type { CreateEmailTemplateDTO, UpdateEmailTemplateDTO } from '@shared/types';
import { z } from "zod";

export const emailTemplatesApi = {
  /**
   * List all email templates
   */
  list: () => api.get<EmailTemplate[]>('/api/email-templates', z.array(emailTemplateSchema)),

  /**
   * Create a new email template
   */
  create: (data: CreateEmailTemplateDTO) =>
    api.post<EmailTemplate>('/api/email-templates', data, emailTemplateSchema),

  /**
   * Update an existing email template
   */
  update: (id: number, data: UpdateEmailTemplateDTO) =>
    api.patch<EmailTemplate>(`/api/email-templates/${id}`, data, emailTemplateSchema),

  /**
   * Delete an email template
   */
  delete: (id: number) => api.delete<void>(`/api/email-templates/${id}`),
};
