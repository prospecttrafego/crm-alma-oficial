import type { Express } from "express";
import { z } from "zod";
import {
  createConversationSchema,
  updateConversationSchema,
  createMessageSchema,
  idParamSchema,
  paginationQuerySchema,
} from "../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  validateQuery,
  asyncHandler,
} from "../middleware";
import { sendSuccess, sendNotFound, toSafeUser } from "../response";
import { storage } from "../storage";
import { broadcast, broadcastToConversation } from "../ws/index";

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

export function registerConversationRoutes(app: Express) {
  // GET /api/conversations - Listar conversas (com paginacao e filtros opcionais)
  app.get(
    "/api/conversations",
    isAuthenticated,
    validateQuery(conversationsQuerySchema),
    asyncHandler(async (req: any, res) => {
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
    asyncHandler(async (req: any, res) => {
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
    asyncHandler(async (req: any, res) => {
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
    asyncHandler(async (req: any, res) => {
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
    asyncHandler(async (req: any, res) => {
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
    asyncHandler(async (req: any, res) => {
      const { id: conversationId } = req.validatedParams;
      const senderId = (req.user as any).id;

      const message = await storage.createMessage({
        ...req.validatedBody,
        conversationId,
        senderId,
        senderType: "user",
      });
      // Broadcast direcionado para usuarios inscritos na conversa
      broadcastToConversation(conversationId, "message:created", message);

      // Create notification for assigned user if not the sender
      const conversation = await storage.getConversation(conversationId);
      if (conversation?.assignedToId && conversation.assignedToId !== senderId) {
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
          console.error("[FCM] Error sending push notification:", pushError);
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
    asyncHandler(async (req: any, res) => {
      const { id: conversationId } = req.validatedParams;
      const userId = (req.user as any).id;

      const count = await storage.markMessagesAsRead(conversationId, userId);

      // Broadcast read event para usuarios inscritos na conversa
      broadcastToConversation(conversationId, "message:read", { conversationId, userId, count });

      sendSuccess(res, { success: true, count });
    }),
  );
}
