import type { Express } from "express";
import { z } from "zod";
import { savedViewTypes } from "../../shared/schema";
import {
  insertSavedViewSchema,
  updateSavedViewSchema,
  idParamSchema,
} from "../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  validateQuery,
  asyncHandler,
} from "../middleware";
import { sendSuccess, sendNotFound, sendValidationError } from "../response";
import { storage } from "../storage";

// Schema para query de saved views
const savedViewsQuerySchema = z.object({
  type: z.enum(savedViewTypes),
});

export function registerSavedViewRoutes(app: Express) {
  // GET /api/saved-views - Listar views salvas por tipo
  app.get(
    "/api/saved-views",
    isAuthenticated,
    validateQuery(savedViewsQuerySchema),
    asyncHandler(async (req: any, res) => {
      const userId = (req.user as any).id;
      const { type } = req.validatedQuery;
      const views = await storage.getSavedViews(userId, type);
      sendSuccess(res, views);
    }),
  );

  // POST /api/saved-views - Criar view salva
  app.post(
    "/api/saved-views",
    isAuthenticated,
    validateBody(insertSavedViewSchema),
    asyncHandler(async (req: any, res) => {
      const userId = (req.user as any).id;
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }

      const view = await storage.createSavedView({
        ...req.validatedBody,
        userId,
        organizationId: org.id,
      });
      sendSuccess(res, view, 201);
    }),
  );

  // PATCH /api/saved-views/:id - Atualizar view salva
  app.patch(
    "/api/saved-views/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateSavedViewSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;

      const view = await storage.updateSavedView(id, userId, req.validatedBody);
      if (!view) {
        return sendNotFound(res, "Saved view not found");
      }
      sendSuccess(res, view);
    }),
  );

  // DELETE /api/saved-views/:id - Excluir view salva
  app.delete(
    "/api/saved-views/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req: any, res) => {
      const { id } = req.validatedParams;
      const userId = (req.user as any).id;
      await storage.deleteSavedView(id, userId);
      res.status(204).send();
    }),
  );
}
