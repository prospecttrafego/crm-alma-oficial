import type { Express } from "express";
import { z } from "zod";
import { insertPipelineSchema, insertPipelineStageSchema } from "@shared/schema";
import { isAuthenticated, requireRole } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

const updatePipelineSchema = insertPipelineSchema.partial().omit({ organizationId: true });
const updatePipelineStageSchema = insertPipelineStageSchema.partial().omit({ pipelineId: true });

export function registerPipelineRoutes(app: Express) {
  app.get("/api/pipelines/default", isAuthenticated, async (_req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }
      const pipeline = await storage.getDefaultPipeline(org.id);
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      const stages = await storage.getPipelineStages(pipeline.id);
      const pipelineDeals = await storage.getDealsByPipeline(pipeline.id);
      res.json({ ...pipeline, stages, deals: pipelineDeals });
    } catch (error) {
      console.error("Error fetching pipeline:", error);
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  app.get("/api/pipelines", isAuthenticated, async (_req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const allPipelines = await storage.getPipelines(org.id);
      const pipelinesWithStages = await Promise.all(
        allPipelines.map(async (p) => {
          const stages = await storage.getPipelineStages(p.id);
          return { ...p, stages };
        }),
      );
      res.json(pipelinesWithStages);
    } catch (error) {
      console.error("Error fetching pipelines:", error);
      res.status(500).json({ message: "Failed to fetch pipelines" });
    }
  });

  app.get("/api/pipelines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const pipeline = await storage.getPipeline(id);
      if (!pipeline) return res.status(404).json({ message: "Pipeline not found" });
      const stages = await storage.getPipelineStages(pipeline.id);
      const pipelineDeals = await storage.getDealsByPipeline(pipeline.id);
      res.json({ ...pipeline, stages, deals: pipelineDeals });
    } catch (error) {
      console.error("Error fetching pipeline:", error);
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  // Pipeline management - admin only
  app.post("/api/pipelines", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;

      const parsed = insertPipelineSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const pipeline = await storage.createPipeline(parsed.data);

      if (Array.isArray(req.body.stages)) {
        const parsedStages = z.array(insertPipelineStageSchema.omit({ pipelineId: true })).safeParse(req.body.stages);
        if (!parsedStages.success) {
          return res.status(400).json({ message: "Invalid stages", errors: parsedStages.error.issues });
        }
        for (const stage of parsedStages.data) {
          await storage.createPipelineStage({ ...stage, pipelineId: pipeline.id });
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
      res.status(201).json({ ...pipeline, stages });
    } catch (error) {
      console.error("Error creating pipeline:", error);
      res.status(500).json({ message: "Failed to create pipeline" });
    }
  });

  app.patch("/api/pipelines/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;

      const existing = await storage.getPipeline(id);
      if (!existing) return res.status(404).json({ message: "Pipeline not found" });

      const parsed = updatePipelineSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const pipeline = await storage.updatePipeline(id, parsed.data);

      await storage.createAuditLog({
        userId,
        action: "update",
        entityType: "pipeline",
        entityId: id,
        entityName: pipeline?.name,
        organizationId: existing.organizationId,
        changes: {
          before: existing as unknown as Record<string, unknown>,
          after: pipeline as unknown as Record<string, unknown>,
        },
      });

      broadcast("pipeline:updated", pipeline);
      res.json(pipeline);
    } catch (error) {
      console.error("Error updating pipeline:", error);
      res.status(500).json({ message: "Failed to update pipeline" });
    }
  });

  app.delete("/api/pipelines/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;

      const existing = await storage.getPipeline(id);
      if (!existing) return res.status(404).json({ message: "Pipeline not found" });

      if (existing.isDefault) {
        return res.status(400).json({ message: "Cannot delete default pipeline" });
      }

      const dealsInPipeline = await storage.getDealsByPipeline(id);
      if (dealsInPipeline.length > 0) {
        return res.status(400).json({ message: "Cannot delete pipeline with existing deals" });
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
    } catch (error) {
      console.error("Error deleting pipeline:", error);
      res.status(500).json({ message: "Failed to delete pipeline" });
    }
  });

  app.post("/api/pipelines/:id/set-default", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const existing = await storage.getPipeline(id);
      if (!existing) return res.status(404).json({ message: "Pipeline not found" });

      const pipeline = await storage.setDefaultPipeline(id, existing.organizationId);
      broadcast("pipeline:updated", pipeline);
      res.json(pipeline);
    } catch (error) {
      console.error("Error setting default pipeline:", error);
      res.status(500).json({ message: "Failed to set default pipeline" });
    }
  });

  app.post("/api/pipelines/:id/stages", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      if (isNaN(pipelineId)) return res.status(400).json({ message: "Invalid pipeline ID" });

      const parsed = insertPipelineStageSchema.safeParse({ ...req.body, pipelineId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }

      const stage = await storage.createPipelineStage(parsed.data);
      broadcast("pipeline:stage:created", stage);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating pipeline stage:", error);
      res.status(500).json({ message: "Failed to create pipeline stage" });
    }
  });

  app.patch(
    "/api/pipelines/:pipelineId/stages/:id",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

        const parsed = updatePipelineStageSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
        }

        const stage = await storage.updatePipelineStage(id, parsed.data);
        if (!stage) return res.status(404).json({ message: "Stage not found" });
        broadcast("pipeline:stage:updated", stage);
        res.json(stage);
      } catch (error) {
        console.error("Error updating pipeline stage:", error);
        res.status(500).json({ message: "Failed to update pipeline stage" });
      }
    },
  );

  app.delete(
    "/api/pipelines/:pipelineId/stages/:id",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

        await storage.deletePipelineStage(id);
        broadcast("pipeline:stage:deleted", { id });
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting pipeline stage:", error);
        res.status(500).json({ message: "Failed to delete pipeline stage" });
      }
    },
  );
}

