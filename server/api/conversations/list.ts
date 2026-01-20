import type { Express } from "express";
import {
  createConversationSchema,
  updateConversationSchema,
  idParamSchema,
} from "../../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  validateQuery,
  asyncHandler,
} from "../../middleware";
import { sendSuccess, sendNotFound } from "../../response";
import { storage } from "../../storage";
import { broadcast } from "../../ws/index";
import { conversationsQuerySchema } from "./schemas";

export function registerConversationListRoutes(app: Express) {
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
        return sendSuccess(res, result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allConversations = await storage.getConversations(org.id);
      sendSuccess(res, allConversations);
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
}
