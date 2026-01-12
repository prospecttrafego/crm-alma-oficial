/**
 * Conversations API - CRUD operations for conversations and messages
 */

import { api } from './index';
import type { Conversation, Message } from '@shared/schema';
import type {
  CreateConversationDTO,
  UpdateConversationDTO,
  CreateMessageDTO,
  ConversationWithRelations,
  MessagesResponse,
} from '@shared/types';

export type {
  ConversationWithRelations,
  MessagesResponse,
  ContactWithCompany,
  MessageWithSender,
} from '@shared/types';

export const conversationsApi = {
  /**
   * List all conversations
   */
  list: () => api.get<ConversationWithRelations[]>('/api/conversations'),

  /**
   * Create a new conversation
   */
  create: (data: CreateConversationDTO) =>
    api.post<Conversation>('/api/conversations', data),

  /**
   * Update a conversation
   */
  update: (id: number, data: UpdateConversationDTO) =>
    api.patch<Conversation>(`/api/conversations/${id}`, data),

  /**
   * Close a conversation
   */
  close: (id: number) =>
    api.patch<Conversation>(`/api/conversations/${id}`, { status: 'closed' }),

  /**
   * Reopen a conversation
   */
  reopen: (id: number) =>
    api.patch<Conversation>(`/api/conversations/${id}`, { status: 'open' }),

  // ===== MESSAGES =====

  /**
   * List messages in a conversation (paginated)
   */
  listMessages: (conversationId: number, cursor?: number, limit = 30) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', String(cursor));
    params.set('limit', String(limit));
    return api.get<MessagesResponse>(
      `/api/conversations/${conversationId}/messages?${params.toString()}`
    );
  },

  /**
   * Send a message to a conversation
   */
  sendMessage: (conversationId: number, data: CreateMessageDTO) =>
    api.post<Message>(`/api/conversations/${conversationId}/messages`, data),

  /**
   * Mark messages as read
   */
  markAsRead: (conversationId: number) =>
    api.post<void>(`/api/conversations/${conversationId}/read`, {}),
};
