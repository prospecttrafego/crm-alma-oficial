import type { Express } from "express";
import { z } from "zod";
import {
  createPipelineSchema,
  updatePipelineSchema,
  updatePipelineStageSchema,
  createPipelineStageInlineSchema,
  idParamSchema,
  pipelineStageParamsSchema,
} from "../validation";
import {
  isAuthenticated,
  requireRole,
  validateBody,
  validateParams,
  asyncHandler,
  getCurrentUser,
} from "../middleware";
import { sendSuccess, sendNotFound, sendError, ErrorCodes } from "../response";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

export function registerPipelineRoutes(app: Express) {
  // GET /api/pipelines/default - Obter pipeline padrao
  app.get(
    "/api/pipelines/default",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "Organization not found");
      }
      const pipeline = await storage.getDefaultPipeline(org.id);
      if (!pipeline) {
        return sendNotFound(res, "Pipeline not found");
      }
      const stages = await storage.getPipelineStages(pipeline.id);
      sendSuccess(res, { ...pipeline, stages });
    }),
  );

  // GET /api/pipelines - Listar todos os pipelines
  app.get(
    "/api/pipelines",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);
      const allPipelines = await storage.getPipelines(org.id);
      const pipelinesWithStages = await Promise.all(
        allPipelines.map(async (p) => {
          const stages = await storage.getPipelineStages(p.id);
          return { ...p, stages };
        }),
      );
      sendSuccess(res, pipelinesWithStages);
    }),
  );

  // GET /api/pipelines/:id - Obter pipeline por ID
  app.get(
    "/api/pipelines/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const pipeline = await storage.getPipeline(id);
      if (!pipeline) {
        return sendNotFound(res, "Pipeline not found");
      }
      const stages = await storage.getPipelineStages(pipeline.id);
      sendSuccess(res, { ...pipeline, stages });
    }),
  );

  // POST /api/pipelines - Criar pipeline (admin only)
  app.post(
    "/api/pipelines",
    isAuthenticated,
    requireRole("admin"),
    validateBody(createPipelineSchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "No organization");
      }
      const userId = getCurrentUser(req)!.id;

      const pipeline = await storage.createPipeline({
        ...req.validatedBody,
        organizationId: org.id,
      });

      // Processar stages inline se fornecidos
      if (Array.isArray(req.body.stages)) {
        const parsedStages = z.array(createPipelineStageInlineSchema).safeParse(req.body.stages);
        if (parsedStages.success) {
          for (const stage of parsedStages.data) {
            await storage.createPipelineStage({ ...stage, pipelineId: pipeline.id });
          }
        }
      }

      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "pipeline",
        entityId: pipeline.id,
        entityName: pipeline.name,
        organizationId: org.id,
        changes: { after: pipeline as unknown as Record<string, unknown> },
      });

      const stages = await storage.getPipelineStages(pipeline.id);
      broadcast("pipeline:created", { ...pipeline, stages });
      sendSuccess(res, { ...pipeline, stages }, 201);
    }),
  );

  // PATCH /api/pipelines/:id - Atualizar pipeline (admin only)
  app.patch(
    "/api/pipelines/:id",
    isAuthenticated,
    requireRole("admin"),
    validateParams(idParamSchema),
    validateBody(updatePipelineSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      const existing = await storage.getPipeline(id);
      if (!existing) {
        return sendNotFound(res, "Pipeline not found");
      }

      const pipeline = await storage.updatePipeline(id, req.validatedBody);
      if (!pipeline) {
        return sendNotFound(res, "Pipeline not found");
      }

      const stages = await storage.getPipelineStages(pipeline.id);

      await storage.createAuditLog({
        userId,
        action: "update",
        entityType: "pipeline",
        entityId: id,
        entityName: pipeline.name,
        organizationId: existing.organizationId,
        changes: {
          before: existing as unknown as Record<string, unknown>,
          after: pipeline as unknown as Record<string, unknown>,
        },
      });

      const responsePayload = { ...pipeline, stages };
      broadcast("pipeline:updated", responsePayload);
      sendSuccess(res, responsePayload);
    }),
  );

  // DELETE /api/pipelines/:id - Excluir pipeline (admin only)
  app.delete(
    "/api/pipelines/:id",
    isAuthenticated,
    requireRole("admin"),
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      const existing = await storage.getPipeline(id);
      if (!existing) {
        return sendNotFound(res, "Pipeline not found");
      }

      if (existing.isDefault) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Cannot delete default pipeline", 400);
      }

      const dealsInPipeline = await storage.getDealsByPipeline(id);
      if (dealsInPipeline.length > 0) {
        return sendError(res, ErrorCodes.CONFLICT, "Cannot delete pipeline with existing deals", 409);
      }

      await storage.deletePipeline(id);

      await storage.createAuditLog({
        userId,
        action: "delete",
        entityType: "pipeline",
        entityId: id,
        entityName: existing.name,
        organizationId: existing.organizationId,
        changes: { before: existing as unknown as Record<string, unknown> },
      });

      broadcast("pipeline:deleted", { id });
      res.status(204).send();
    }),
  );

  // POST /api/pipelines/:id/set-default - Definir pipeline padrao (admin only)
  app.post(
    "/api/pipelines/:id/set-default",
    isAuthenticated,
    requireRole("admin"),
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const existing = await storage.getPipeline(id);
      if (!existing) {
        return sendNotFound(res, "Pipeline not found");
      }

      const pipeline = await storage.setDefaultPipeline(id, existing.organizationId);
      if (!pipeline) {
        return sendNotFound(res, "Pipeline not found");
      }

      const stages = await storage.getPipelineStages(pipeline.id);
      const responsePayload = { ...pipeline, stages };
      broadcast("pipeline:updated", responsePayload);
      sendSuccess(res, responsePayload);
    }),
  );

  // POST /api/pipelines/:id/stages - Criar stage no pipeline (admin only)
  app.post(
    "/api/pipelines/:id/stages",
    isAuthenticated,
    requireRole("admin"),
    validateParams(idParamSchema),
    validateBody(createPipelineStageInlineSchema),
    asyncHandler(async (req, res) => {
      const { id: pipelineId } = req.validatedParams;

      const stage = await storage.createPipelineStage({
        ...req.validatedBody,
        pipelineId,
      });
      broadcast("pipeline:stage:created", stage);
      sendSuccess(res, stage, 201);
    }),
  );

  // PATCH /api/pipelines/:pipelineId/stages/:id - Atualizar stage (admin only)
  app.patch(
    "/api/pipelines/:pipelineId/stages/:id",
    isAuthenticated,
    requireRole("admin"),
    validateParams(pipelineStageParamsSchema),
    validateBody(updatePipelineStageSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      const stage = await storage.updatePipelineStage(id, req.validatedBody);
      if (!stage) {
        return sendNotFound(res, "Stage not found");
      }
      broadcast("pipeline:stage:updated", stage);
      sendSuccess(res, stage);
    }),
  );

  // DELETE /api/pipelines/:pipelineId/stages/:id - Excluir stage (admin only)
  app.delete(
    "/api/pipelines/:pipelineId/stages/:id",
    isAuthenticated,
    requireRole("admin"),
    validateParams(pipelineStageParamsSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;

      await storage.deletePipelineStage(id);
      broadcast("pipeline:stage:deleted", { id });
      res.status(204).send();
    }),
  );
}
