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

  /**
   * Search messages by content
   */
  searchMessages: (params: {
    q: string;
    conversationId?: number;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('q', params.q);
    if (params.conversationId) searchParams.set('conversationId', String(params.conversationId));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    return api.get<MessageSearchResponse>(`/api/messages/search?${searchParams.toString()}`, messageSearchResponseSchema);
  },

  /**
   * Edit a message (within 15 minute window)
   */
  editMessage: (messageId: number, content: string) =>
    api.patch<Message>(`/api/messages/${messageId}`, { content }, messageSchema),

  /**
   * Delete a message (soft delete)
   */
  deleteMessage: (messageId: number) =>
    api.delete<{ id: number; deleted: boolean }>(`/api/messages/${messageId}`, z.object({
      id: z.number().int(),
      deleted: z.boolean(),
    })),
};

// Message search response types
export const messageSearchResultSchema = z.object({
  id: z.number().int(),
  conversationId: z.number().int(),
  content: z.string(),
  createdAt: z.coerce.date().nullable(),
  senderId: z.string().nullable(),
  senderType: z.string().nullable(),
  senderName: z.string().nullable(),
  conversationSubject: z.string().nullable(),
  rank: z.number(),
});

export const messageSearchResponseSchema = z.object({
  results: z.array(messageSearchResultSchema),
  total: z.number().int(),
});

export type MessageSearchResult = z.infer<typeof messageSearchResultSchema>;
export type MessageSearchResponse = z.infer<typeof messageSearchResponseSchema>;
