import type { Express } from "express";
import { z } from "zod";
import {
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
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
import { sendSuccess, sendNotFound } from "../response";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

// Schema estendido para query de deals (adiciona campos especificos)
const dealsQuerySchema = paginationQuerySchema.extend({
  pipelineId: z.coerce.number().int().positive().optional(),
  stageId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
});

export function registerDealRoutes(app: Express) {
  // GET /api/deals - Listar deals (com paginacao e filtros opcionais)
  app.get(
    "/api/deals",
    isAuthenticated,
    validateQuery(dealsQuerySchema),
    asyncHandler(async (req, res) => {
      const paginationOrFilterRequested =
        req.query?.page !== undefined ||
        req.query?.limit !== undefined ||
        req.query?.search !== undefined ||
        req.query?.sortBy !== undefined ||
        req.query?.sortOrder !== undefined ||
        req.query?.pipelineId !== undefined ||
        req.query?.stageId !== undefined ||
        req.query?.status !== undefined;

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

      const { page, limit, search, sortBy, sortOrder, pipelineId, stageId, status } = req.validatedQuery;

      // Check if pagination/filtering is requested
      if (paginationOrFilterRequested) {
        const result = await storage.getDealsPaginated(org.id, {
          page,
          limit,
          search,
          sortBy,
          sortOrder,
          pipelineId,
          stageId,
          status,
        });
        return sendSuccess(res, result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allDeals = await storage.getDeals(org.id);
      sendSuccess(res, allDeals);
    }),
  );

  // GET /api/deals/:id - Obter deal por ID
  app.get(
    "/api/deals/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const deal = await storage.getDeal(id);
      if (!deal) {
        return sendNotFound(res, "Deal not found");
      }
      sendSuccess(res, deal);
    }),
  );

  // POST /api/deals - Criar deal
  app.post(
    "/api/deals",
    isAuthenticated,
    validateBody(createDealSchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = getCurrentUser(req)!.id;

      const deal = await storage.createDeal({
        ...req.validatedBody,
        organizationId: org.id,
      });

      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "deal",
        entityId: deal.id,
        entityName: deal.title,
        organizationId: org.id,
        changes: { after: deal as unknown as Record<string, unknown> },
      });

      broadcast("deal:created", deal);
      sendSuccess(res, deal, 201);
    }),
  );

  // PATCH /api/deals/:id - Atualizar deal
  app.patch(
    "/api/deals/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateDealSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      const existingDeal = await storage.getDeal(id);
      if (!existingDeal) {
        return sendNotFound(res, "Deal not found");
      }

      const deal = await storage.updateDeal(id, req.validatedBody);
      if (!deal) {
        return sendNotFound(res, "Deal not found");
      }

      const org = await storage.getDefaultOrganization();
      if (org) {
        await storage.createAuditLog({
          userId,
          action: "update",
          entityType: "deal",
          entityId: deal.id,
          entityName: deal.title,
          organizationId: org.id,
          changes: {
            before: existingDeal as unknown as Record<string, unknown>,
            after: deal as unknown as Record<string, unknown>,
          },
        });
      }

      broadcast("deal:updated", deal);
      sendSuccess(res, deal);
    }),
  );

  // PATCH /api/deals/:id/stage - Mover deal para outro stage
  app.patch(
    "/api/deals/:id/stage",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(moveDealSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const { stageId, status, lostReason } = req.validatedBody;
      const userId = getCurrentUser(req)!.id;

      const deal = await storage.moveDealToStage(id, stageId, { status, lostReason });
      if (!deal) {
        return sendNotFound(res, "Deal not found");
      }
      broadcast("deal:moved", deal);

      if (deal.status === "won" || deal.status === "lost") {
        await storage.createNotification({
          userId,
          type: deal.status === "won" ? "deal_won" : "deal_lost",
          title: deal.status === "won" ? "Deal Won!" : "Deal Lost",
          message: `${deal.title} has been marked as ${deal.status}`,
          entityType: "deal",
          entityId: deal.id,
        });
        broadcast("notification:new", { userId });
      }
      sendSuccess(res, deal);
    }),
  );

  // DELETE /api/deals/:id - Excluir deal
  app.delete(
    "/api/deals/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      const existingDeal = await storage.getDeal(id);
      await storage.deleteDeal(id);

      const org = await storage.getDefaultOrganization();
      if (org && existingDeal) {
        await storage.createAuditLog({
          userId,
          action: "delete",
          entityType: "deal",
          entityId: id,
          entityName: existingDeal.title,
          organizationId: org.id,
          changes: { before: existingDeal as unknown as Record<string, unknown> },
        });
      }

      broadcast("deal:deleted", { id });
      res.status(204).send();
    }),
  );
}
