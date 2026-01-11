/**
 * Conversations API - CRUD operations for conversations and messages
 */

import { api } from './index';
import type { Conversation, Message } from '@shared/schema';
import type {
  CreateConversationDTO,
  UpdateConversationDTO,
  CreateMessageDTO,
} from '@shared/types';

// Extended types
export interface ConversationWithRelations extends Conversation {
  contact?: {
    id: number;
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    company?: {
      id: number;
      name: string;
    } | null;
  } | null;
  deal?: {
    id: number;
    title: string;
  } | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName?: string | null;
  } | null;
}

export interface MessageWithSender extends Message {
  sender?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    profileImageUrl?: string | null;
  } | null;
}

export interface MessagesResponse {
  messages: MessageWithSender[];
  nextCursor: number | null;
  hasMore: boolean;
}

export const conversationsApi = {
  /**
   * List all conversations
   */
  list: () => api.get<ConversationWithRelations[]>('/api/conversations'),

  /**
   * Get a single conversation by ID
   */
  get: (id: number) => api.get<ConversationWithRelations>(`/api/conversations/${id}`),

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
