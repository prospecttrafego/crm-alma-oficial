/**
 * Contacts API - CRUD operations for contacts
 */

import { api } from './index';
import { contactSchema } from "@shared/apiSchemas";
import type { Contact } from '@shared/schema';
import type { CreateContactDTO, UpdateContactDTO } from '@shared/types';
import { z } from "zod";

/**
 * Schema for contact with aggregated statistics
 */
export const contactWithStatsSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  source: z.string().nullable(),
  createdAt: z.string().nullable(),
  company: z.object({
    id: z.number(),
    name: z.string(),
  }).nullable(),
  owner: z.object({
    id: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).nullable(),
  totalDealsValue: z.number(),
  openDealsCount: z.number(),
  lastActivityAt: z.string().nullable(),
});

export type ContactWithStats = z.infer<typeof contactWithStatsSchema>;

export const contactsApi = {
  /**
   * List all contacts
   */
  list: () => api.get<Contact[]>('/api/contacts', z.array(contactSchema)),

  /**
   * List contacts with aggregated statistics (deals value, count, last activity)
   */
  listWithStats: () => api.get<ContactWithStats[]>(
    '/api/contacts?withStats=true',
    z.array(contactWithStatsSchema)
  ),

  /**
   * Create a new contact
   */
  create: (data: CreateContactDTO) => api.post<Contact>('/api/contacts', data, contactSchema),

  /**
   * Update an existing contact
   */
  update: (id: number, data: UpdateContactDTO) =>
    api.patch<Contact>(`/api/contacts/${id}`, data, contactSchema),

  /**
   * Delete a contact
   */
  delete: (id: number) => api.delete<void>(`/api/contacts/${id}`),
};
