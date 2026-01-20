import type { Express } from "express";
import { isAuthenticated, validateQuery, asyncHandler } from "../../middleware";
import { sendSuccess } from "../../response";
import { storage } from "../../storage";
import { messageSearchQuerySchema } from "./schemas";

export function registerMessageSearchRoutes(app: Express) {
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
}
