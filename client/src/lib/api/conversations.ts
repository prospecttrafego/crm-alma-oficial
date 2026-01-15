/**
 * Conversations API - CRUD operations for conversations and messages
 */

import { api } from "./client";
import { conversationWithRelationsSchema, messagesResponseSchema, conversationSchema, messageSchema } from "@shared/apiSchemas";
import type { Conversation, Message } from '@shared/schema';
import type {
  CreateConversationDTO,
  UpdateConversationDTO,
  CreateMessageDTO,
  ConversationWithRelations,
  MessagesResponse,
} from '@shared/types';
import { z } from "zod";

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
  list: () => api.get<ConversationWithRelations[]>('/api/conversations', z.array(conversationWithRelationsSchema)),

  /**
   * Create a new conversation
   */
  create: (data: CreateConversationDTO) =>
    api.post<Conversation>('/api/conversations', data, conversationSchema),

  /**
   * Update a conversation
   */
  update: (id: number, data: UpdateConversationDTO) =>
    api.patch<Conversation>(`/api/conversations/${id}`, data, conversationSchema),

  /**
   * Close a conversation
   */
  close: (id: number) =>
    api.patch<Conversation>(`/api/conversations/${id}`, { status: 'closed' }, conversationSchema),

  /**
   * Reopen a conversation
   */
  reopen: (id: number) =>
    api.patch<Conversation>(`/api/conversations/${id}`, { status: 'open' }, conversationSchema),

  // ===== MESSAGES =====

  /**
   * List messages in a conversation (paginated)
   */
  listMessages: (conversationId: number, cursor?: number, limit = 30) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', String(cursor));
    params.set('limit', String(limit));
    return api.get<MessagesResponse>(
      `/api/conversations/${conversationId}/messages?${params.toString()}`,
      messagesResponseSchema
    );
  },

  /**
   * Send a message to a conversation
   */
  sendMessage: (conversationId: number, data: CreateMessageDTO) =>
    api.post<Message>(`/api/conversations/${conversationId}/messages`, data, messageSchema),

  /**
   * Mark messages as read
   */
  markAsRead: (conversationId: number) =>
    api.post<void>(`/api/conversations/${conversationId}/read`, {}),
};
