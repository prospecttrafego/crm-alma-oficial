import type { Express } from "express";
import { z } from "zod";
import {
  createActivitySchema,
  updateActivitySchema,
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
import { sendSuccess, sendNotFound } from "../response";
import { storage } from "../storage";

// Schema estendido para query de atividades
const activitiesQuerySchema = paginationQuerySchema.extend({
  type: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
});

export function registerActivityRoutes(app: Express) {
  // GET /api/activities - Listar atividades (com paginacao e filtros opcionais)
  app.get(
    "/api/activities",
    isAuthenticated,
    validateQuery(activitiesQuerySchema),
    asyncHandler(async (req, res) => {
      const paginationOrFilterRequested =
        req.query?.page !== undefined ||
        req.query?.limit !== undefined ||
        req.query?.search !== undefined ||
        req.query?.sortBy !== undefined ||
        req.query?.sortOrder !== undefined ||
        req.query?.type !== undefined ||
        req.query?.status !== undefined ||
        req.query?.userId !== undefined;

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

      const { page, limit, search, type, status, userId } = req.validatedQuery;

      // Check if pagination is requested
      if (paginationOrFilterRequested) {
        const result = await storage.getActivitiesPaginated(org.id, {
          page,
          limit,
          search,
          type,
          status,
          userId,
        });
        return sendSuccess(res, result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allActivities = await storage.getActivities(org.id);
      sendSuccess(res, allActivities);
    }),
  );

  // GET /api/activities/:id - Obter atividade por ID
  app.get(
    "/api/activities/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const activity = await storage.getActivity(id);
      if (!activity) {
        return sendNotFound(res, "Activity not found");
      }
      sendSuccess(res, activity);
    }),
  );

  // GET /api/contacts/:id/activities - Listar atividades de um contato
  app.get(
    "/api/contacts/:id/activities",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const activities = await storage.getActivitiesByContact(id);
      sendSuccess(res, activities);
    }),
  );

  // POST /api/activities - Criar atividade
  app.post(
    "/api/activities",
    isAuthenticated,
    validateBody(createActivitySchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }

      const activity = await storage.createActivity({
        ...req.validatedBody,
        organizationId: org.id,
      });
      sendSuccess(res, activity, 201);
    }),
  );

  // PATCH /api/activities/:id - Atualizar atividade
  app.patch(
    "/api/activities/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateActivitySchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const activity = await storage.updateActivity(id, req.validatedBody);
      if (!activity) {
        return sendNotFound(res, "Activity not found");
      }
      sendSuccess(res, activity);
    }),
  );

  // DELETE /api/activities/:id - Excluir atividade
  app.delete(
    "/api/activities/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      await storage.deleteActivity(id);
      res.status(204).send();
    }),
  );
}
