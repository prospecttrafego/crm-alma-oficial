import type { Express } from "express";
import { z } from "zod";
import {
  createConversationSchema,
  updateConversationSchema,
  createMessageSchema,
  updateMessageSchema,
  idParamSchema,
  paginationQuerySchema,
} from "../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  validateQuery,
  asyncHandler,
  getCurrentUser,
} from "../middleware";
import { sendSuccess, sendNotFound, sendForbidden, sendError, ErrorCodes, toSafeUser } from "../response";
import { storage } from "../storage";
import { broadcast, broadcastToConversation } from "../ws/index";
import { logger } from "../logger";

/**
 * Extract mentioned user IDs from message content
 * Format: @[Name](userId)
 */
function extractMentions(content: string | null): string[] {
  if (!content) return [];
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  // Remove duplicates using filter
  return mentions.filter((id, index) => mentions.indexOf(id) === index);
}

// Schema estendido para query de conversas
const conversationsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  channel: z.string().optional(),
  assignedToId: z.string().optional(),
});

// Schema para paginacao de mensagens
const messagesQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(30),
});

// Schema para busca de mensagens
const messageSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  conversationId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export function registerConversationRoutes(app: Express) {
  // GET /api/messages/search - Buscar mensagens por conteudo
  app.get(
    "/api/messages/search",
    isAuthenticated,
    validateQuery(messageSearchQuerySchema),
    asyncHandler(async (req, res) => {
      const { q, conversationId, limit, offset } = req.validatedQuery;

      const result = await storage.searchMessages(q, {
        conversationId,
        limit,
        offset,
      });

      sendSuccess(res, result);
    }),
  );
  // GET /api/conversations - Listar conversas (com paginacao e filtros opcionais)
  app.get(
    "/api/conversations",
    isAuthenticated,
    validateQuery(conversationsQuerySchema),
    asyncHandler(async (req, res) => {
      const paginationOrFilterRequested =
        req.query?.page !== undefined ||
        req.query?.limit !== undefined ||
        req.query?.search !== undefined ||
        req.query?.sortBy !== undefined ||
        req.query?.sortOrder !== undefined ||
        req.query?.status !== undefined ||
        req.query?.channel !== undefined ||
        req.query?.assignedToId !== undefined;

      const org = await storage.getDefaultOrganization();
      if (!org) {
        if (!paginationOrFilterRequested) return sendSuccess(res, []);
        const page = req.validatedQuery.page ?? 1;
        const limit = req.validatedQuery.limit ?? 20;
        return sendSuccess(res, {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        });
      }

      // Helper function to enrich conversations
      const enrichConversations = async (convList: any[]) => {
        return Promise.all(
          convList.map(async (conv) => {
            let contact = null;
            let company = null;
            let deal = null;
            let assignedTo = null;

            if (conv.contactId) {
              contact = await storage.getContact(conv.contactId);
              if (contact?.companyId) {
                company = await storage.getCompany(contact.companyId);
              }
            }
            if (conv.dealId) {
              deal = await storage.getDeal(conv.dealId);
              if (!company && deal?.companyId) {
                company = await storage.getCompany(deal.companyId);
              }
            }
            if (conv.assignedToId) {
              assignedTo = await storage.getUser(conv.assignedToId);
            }

            return {
              ...conv,
              contact: contact ? { ...contact, company } : null,
              deal,
              company,
              assignedTo: assignedTo ? toSafeUser(assignedTo) : null,
            };
          }),
        );
      };

      const { page, limit, search, status, channel, assignedToId } = req.validatedQuery;

      // Check if pagination is requested
      if (paginationOrFilterRequested) {
        const result = await storage.getConversationsPaginated(org.id, {
          page,
          limit,
          search,
          status,
          channel,
          assignedToId,
        });
        const enrichedData = await enrichConversations(result.data);
        return sendSuccess(res, { ...result, data: enrichedData });
      }

      // Fallback to non-paginated (for backward compatibility)
      const allConversations = await storage.getConversations(org.id);
      const enrichedConversations = await enrichConversations(allConversations);
      sendSuccess(res, enrichedConversations);
    }),
  );

  // GET /api/conversations/:id - Obter conversa por ID
  app.get(
    "/api/conversations/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return sendNotFound(res, "Conversation not found");
      }
      const conversationMessages = await storage.getMessages(id);
      sendSuccess(res, { ...conversation, messages: conversationMessages });
    }),
  );

  // POST /api/conversations - Criar conversa
  app.post(
    "/api/conversations",
    isAuthenticated,
    validateBody(createConversationSchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }

      const conversation = await storage.createConversation({
        ...req.validatedBody,
        organizationId: org.id,
      });
      broadcast("conversation:created", conversation);
      sendSuccess(res, conversation, 201);
    }),
  );

  // PATCH /api/conversations/:id - Atualizar conversa
  app.patch(
    "/api/conversations/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateConversationSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const conversation = await storage.updateConversation(id, req.validatedBody);
      if (!conversation) {
        return sendNotFound(res, "Conversation not found");
      }
      sendSuccess(res, conversation);
    }),
  );

  // GET /api/conversations/:id/messages - Listar mensagens da conversa
  app.get(
    "/api/conversations/:id/messages",
    isAuthenticated,
    validateParams(idParamSchema),
    validateQuery(messagesQuerySchema),
    asyncHandler(async (req, res) => {
      const { id: conversationId } = req.validatedParams;
      const { cursor, limit } = req.validatedQuery;

      const result = await storage.getMessages(conversationId, { cursor, limit });
      sendSuccess(res, result);
    }),
  );

  // POST /api/conversations/:id/messages - Criar mensagem na conversa
  app.post(
    "/api/conversations/:id/messages",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(createMessageSchema),
    asyncHandler(async (req, res) => {
      const { id: conversationId } = req.validatedParams;
      const senderId = getCurrentUser(req)!.id;

      // Extract mentioned users before creating message
      const mentionedUserIds = extractMentions(req.validatedBody.content);

      const message = await storage.createMessage({
        ...req.validatedBody,
        conversationId,
        senderId,
        senderType: "user",
        // Store mentions in the message for reference
        mentions: mentionedUserIds.length > 0 ? mentionedUserIds : null,
      });
      // Broadcast direcionado para usuarios inscritos na conversa
      broadcastToConversation(conversationId, "message:created", message);

      const conversation = await storage.getConversation(conversationId);

      // Create notifications for mentioned users
      if (mentionedUserIds.length > 0) {
        const sender = await storage.getUser(senderId);
        const senderName = sender
          ? [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.email
          : "User";

        for (const mentionedUserId of mentionedUserIds) {
          // Don't notify the sender
          if (mentionedUserId === senderId) continue;

          await storage.createNotification({
            userId: mentionedUserId,
            type: "mention",
            title: "You were mentioned",
            message: `${senderName} mentioned you in a message`,
            entityType: "conversation",
            entityId: conversationId,
          });
          broadcast("notification:new", { userId: mentionedUserId });

          // Send push notification if user is offline
          try {
            const { isUserOnline } = await import("../redis");
            const isOnline = await isUserOnline(mentionedUserId);

            if (!isOnline) {
              const { sendNotificationToUser, isFcmAvailable } = await import(
                "../integrations/firebase/notifications"
              );

              if (isFcmAvailable()) {
                const preview = message.content?.substring(0, 100) || "New mention";
                await sendNotificationToUser(
                  mentionedUserId,
                  "mention",
                  {
                    senderName,
                    preview,
                    conversationId,
                    senderAvatar: sender?.profileImageUrl,
                  },
                  {
                    getPushTokens: storage.getPushTokensForUser.bind(storage),
                    deletePushToken: storage.deletePushToken.bind(storage),
                  }
                );
              }
            }
          } catch (pushError) {
            logger.error("[FCM] Error sending mention push notification:", { error: pushError });
          }
        }
      }

      // Create notification for assigned user if not the sender (and not already notified via mention)
      if (conversation?.assignedToId && conversation.assignedToId !== senderId && !mentionedUserIds.includes(conversation.assignedToId)) {
        await storage.createNotification({
          userId: conversation.assignedToId,
          type: "new_message",
          title: "New Message",
          message: `New message in conversation: ${conversation.subject || "No subject"}`,
          entityType: "conversation",
          entityId: conversationId,
        });
        broadcast("notification:new", { userId: conversation.assignedToId });

        // Send push notification if user is offline
        try {
          const { isUserOnline } = await import("../redis");
          const isOnline = await isUserOnline(conversation.assignedToId);

          if (!isOnline) {
            const { sendNotificationToUser, isFcmAvailable } = await import(
              "../integrations/firebase/notifications"
            );

            if (isFcmAvailable()) {
              const sender = await storage.getUser(senderId);
              const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Usuário";
              const preview = message.content?.substring(0, 100) || "Nova mensagem";

              // Use the high-level function that handles token lookup and cleanup
              await sendNotificationToUser(
                conversation.assignedToId,
                "message:new",
                {
                  senderName,
                  preview,
                  conversationId,
                  senderAvatar: sender?.profileImageUrl,
                },
                {
                  getPushTokens: storage.getPushTokensForUser.bind(storage),
                  deletePushToken: storage.deletePushToken.bind(storage),
                }
              );
            }
          }
        } catch (pushError) {
          logger.error("[FCM] Error sending push notification:", { error: pushError });
        }
      }

      sendSuccess(res, message, 201);
    }),
  );

  // POST /api/conversations/:id/read - Marcar mensagens como lidas
  app.post(
    "/api/conversations/:id/read",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id: conversationId } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      const count = await storage.markMessagesAsRead(conversationId, userId);

      // Broadcast read event para usuarios inscritos na conversa
      broadcastToConversation(conversationId, "message:read", { conversationId, userId, count });

      sendSuccess(res, { success: true, count });
    }),
  );

  // PATCH /api/messages/:id - Editar mensagem
  app.patch(
    "/api/messages/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateMessageSchema),
    asyncHandler(async (req, res) => {
      const { id: messageId } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;
      const { content } = req.validatedBody;

      // Get message to find conversationId for broadcast
      const existingMessage = await storage.getMessage(messageId);
      if (!existingMessage) {
        return sendNotFound(res, "Message not found");
      }

      // Check if user is the sender
      if (existingMessage.senderId !== userId) {
        return sendForbidden(res, "You can only edit your own messages");
      }

      const updatedMessage = await storage.updateMessage(messageId, userId, content);
      if (!updatedMessage) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Cannot edit message. Edit window may have expired (15 minutes).", 400);
      }

      // Broadcast message:updated to conversation room
      broadcastToConversation(existingMessage.conversationId, "message:updated", updatedMessage);

      sendSuccess(res, updatedMessage);
    }),
  );

  // DELETE /api/messages/:id - Soft delete mensagem
  app.delete(
    "/api/messages/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id: messageId } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      // Get message to find conversationId for broadcast
      const existingMessage = await storage.getMessage(messageId);
      if (!existingMessage) {
        return sendNotFound(res, "Message not found");
      }

      // Check if user is the sender
      if (existingMessage.senderId !== userId) {
        return sendForbidden(res, "You can only delete your own messages");
      }

      const deletedMessage = await storage.softDeleteMessage(messageId, userId);
      if (!deletedMessage) {
        return sendNotFound(res, "Message not found");
      }

      // Broadcast message:deleted to conversation room
      broadcastToConversation(existingMessage.conversationId, "message:deleted", {
        id: messageId,
        conversationId: existingMessage.conversationId,
        deletedAt: deletedMessage.deletedAt,
      });

      sendSuccess(res, { id: messageId, deleted: true });
    }),
  );
}
