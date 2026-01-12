/**
 * Contacts API - CRUD operations for contacts
 */

import { api } from './index';
import type { Contact } from '@shared/schema';
import type { CreateContactDTO, UpdateContactDTO } from '@shared/types';

export const contactsApi = {
  /**
   * List all contacts
   */
  list: () => api.get<Contact[]>('/api/contacts'),

  /**
   * Create a new contact
   */
  create: (data: CreateContactDTO) => api.post<Contact>('/api/contacts', data),

  /**
   * Update an existing contact
   */
  update: (id: number, data: UpdateContactDTO) =>
    api.patch<Contact>(`/api/contacts/${id}`, data),

  /**
   * Delete a contact
   */
  delete: (id: number) => api.delete<void>(`/api/contacts/${id}`),
};
