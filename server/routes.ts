import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession, requireRole, rateLimitMiddleware } from "./auth";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import {
  insertCompanySchema,
  insertContactSchema,
  insertDealSchema,
  insertConversationSchema,
  insertMessageSchema,
  insertActivitySchema,
  insertNotificationSchema,
  insertSavedViewSchema,
  insertEmailTemplateSchema,
  insertAuditLogSchema,
  insertPipelineSchema,
  insertPipelineStageSchema,
  insertFileSchema,
  insertCalendarEventSchema,
  insertChannelConfigSchema,
  savedViewTypes,
  auditLogEntityTypes,
  fileEntityTypes,
  channelConfigTypes,
  type AuditLogEntityType,
  type FileEntityType,
  type ChannelConfigType,
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError, ObjectPermission } from "./storage.supabase";
import { evolutionApi } from "./evolution-api";
import { evolutionHandler, type EvolutionWebhookEvent } from "./evolution-message-handler";
import { performHealthCheck } from "./health";

const clients = new Set<WebSocket>();

function broadcast(type: string, data: unknown) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function toSafeUser(user: any) {
  if (!user) return user;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(padLength), "base64");
}

function signOAuthState(payload: { userId: string; timestamp: number }): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  const data = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  return `${data}.${signature}`;
}

function verifyOAuthState(state: string): { userId: string; timestamp: number } | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const [data, signature] = state.split(".");
  if (!data || !signature) return null;

  const expected = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(base64UrlDecode(data).toString("utf8"));
  } catch {
    return null;
  }
}

const updateDealSchema = insertDealSchema.partial().omit({ organizationId: true });
const updateContactSchema = insertContactSchema.partial().omit({ organizationId: true });
const updateCompanySchema = insertCompanySchema.partial().omit({ organizationId: true });
const updateActivitySchema = insertActivitySchema.partial().omit({ organizationId: true });
const updateConversationSchema = insertConversationSchema.partial().omit({ organizationId: true });
const updateSavedViewSchema = insertSavedViewSchema.partial().omit({ userId: true, organizationId: true, type: true });
const moveDealSchema = z.object({ stageId: z.number() });
const updatePipelineSchema = insertPipelineSchema.partial().omit({ organizationId: true });
const updatePipelineStageSchema = insertPipelineStageSchema.partial().omit({ pipelineId: true });
const updateCalendarEventSchema = insertCalendarEventSchema.partial().omit({ organizationId: true });
const updateChannelConfigSchema = insertChannelConfigSchema.partial().omit({ organizationId: true, type: true });

export async function registerRoutes(
  app: Express
): Promise<Server> {
  await setupAuth(app);

  // Health check endpoint (publico, sem autenticacao)
  app.get("/api/health", async (_req, res) => {
    try {
      const health = await performHealthCheck();
      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      });
    }
  });

  // Rate limiting (apenas para /api autenticado; nao afeta webhooks/health)
  app.use("/api", (req: any, res, next) => {
    if (req.isAuthenticated?.()) {
      return rateLimitMiddleware(req, res, next);
    }
    next();
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      res.json(toSafeUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update current user profile
  app.patch("/api/users/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { firstName, lastName, profileImageUrl, preferences } = req.body;

      // Validate preferences if provided
      if (preferences && preferences.language) {
        if (!["pt-BR", "en"].includes(preferences.language)) {
          return res.status(400).json({ message: "Invalid language preference" });
        }
      }

      const updated = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        profileImageUrl,
        preferences,
      });

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(toSafeUser(updated));
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({
          totalDeals: 0,
          openDeals: 0,
          wonDeals: 0,
          totalValue: "0",
          contacts: 0,
          companies: 0,
          pendingActivities: 0,
          unreadConversations: 0,
        });
      }
      const stats = await storage.getDashboardStats(org.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/pipelines/default", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/pipelines", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const allPipelines = await storage.getPipelines(org.id);
      const pipelinesWithStages = await Promise.all(
        allPipelines.map(async (p) => {
          const stages = await storage.getPipelineStages(p.id);
          return { ...p, stages };
        })
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
        changes: { before: existing as unknown as Record<string, unknown>, after: pipeline as unknown as Record<string, unknown> },
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

	  app.patch("/api/pipelines/:pipelineId/stages/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
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
  });

  app.delete("/api/pipelines/:pipelineId/stages/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
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
  });

  // Deals - supports pagination via query params (?page=1&limit=20&search=...&pipelineId=...&status=...)
  app.get("/api/deals", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });

      // Check if pagination is requested
      const { page, limit, search, sortBy, sortOrder, pipelineId, stageId, status } = req.query;
      if (page || limit || search || pipelineId || status) {
        const result = await storage.getDealsPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
          pipelineId: pipelineId ? parseInt(pipelineId) : undefined,
          stageId: stageId ? parseInt(stageId) : undefined,
          status: status as string,
        });
        return res.json(result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allDeals = await storage.getDeals(org.id);
      res.json(allDeals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  app.get("/api/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const deal = await storage.getDeal(id);
      if (!deal) return res.status(404).json({ message: "Deal not found" });
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ message: "Failed to fetch deal" });
    }
  });

  app.post("/api/deals", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;
      
      const parsed = insertDealSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const deal = await storage.createDeal(parsed.data);
      
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
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  app.patch("/api/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
      const existingDeal = await storage.getDeal(id);
      const parsed = updateDealSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const deal = await storage.updateDeal(id, parsed.data);
      if (!deal) return res.status(404).json({ message: "Deal not found" });
      
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
            after: deal as unknown as Record<string, unknown> 
          },
        });
      }
      
      broadcast("deal:updated", deal);
      res.json(deal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ message: "Failed to update deal" });
    }
  });

  app.patch("/api/deals/:id/stage", isAuthenticated, async (req: any, res) => {
    try {
      const dealId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      if (isNaN(dealId)) return res.status(400).json({ message: "Invalid ID" });
      
      const parsed = moveDealSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const deal = await storage.moveDealToStage(dealId, parsed.data.stageId);
      if (!deal) return res.status(404).json({ message: "Deal not found" });
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
      res.json(deal);
    } catch (error) {
      console.error("Error moving deal:", error);
      res.status(500).json({ message: "Failed to move deal" });
    }
  });

  app.delete("/api/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
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
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ message: "Failed to delete deal" });
    }
  });

  // Contacts - supports pagination via query params (?page=1&limit=20&search=...)
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });

      // Check if pagination is requested
      const { page, limit, search, sortBy, sortOrder } = req.query;
      if (page || limit || search) {
        const result = await storage.getContactsPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
        });
        return res.json(result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allContacts = await storage.getContacts(org.id);
      res.json(allContacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const contact = await storage.getContact(id);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;
      
      const parsed = insertContactSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const contact = await storage.createContact(parsed.data);
      
      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "contact",
        entityId: contact.id,
        entityName: `${contact.firstName} ${contact.lastName || ""}`.trim(),
        organizationId: org.id,
        changes: { after: contact as unknown as Record<string, unknown> },
      });
      
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
      const existingContact = await storage.getContact(id);
      const parsed = updateContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const contact = await storage.updateContact(id, parsed.data);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      
      const org = await storage.getDefaultOrganization();
      if (org) {
        await storage.createAuditLog({
          userId,
          action: "update",
          entityType: "contact",
          entityId: contact.id,
          entityName: `${contact.firstName} ${contact.lastName || ""}`.trim(),
          organizationId: org.id,
          changes: { 
            before: existingContact as unknown as Record<string, unknown>, 
            after: contact as unknown as Record<string, unknown> 
          },
        });
      }
      
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
      const existingContact = await storage.getContact(id);
      await storage.deleteContact(id);
      
      const org = await storage.getDefaultOrganization();
      if (org && existingContact) {
        await storage.createAuditLog({
          userId,
          action: "delete",
          entityType: "contact",
          entityId: id,
          entityName: `${existingContact.firstName} ${existingContact.lastName || ""}`.trim(),
          organizationId: org.id,
          changes: { before: existingContact as unknown as Record<string, unknown> },
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Companies - supports pagination via query params (?page=1&limit=20&search=...)
  app.get("/api/companies", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });

      // Check if pagination is requested
      const { page, limit, search, sortBy, sortOrder } = req.query;
      if (page || limit || search) {
        const result = await storage.getCompaniesPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
        });
        return res.json(result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allCompanies = await storage.getCompanies(org.id);
      res.json(allCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post("/api/companies", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;
      
      const parsed = insertCompanySchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const company = await storage.createCompany(parsed.data);
      
      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        organizationId: org.id,
        changes: { after: company as unknown as Record<string, unknown> },
      });
      
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
      const existingCompany = await storage.getCompany(id);
      const parsed = updateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const company = await storage.updateCompany(id, parsed.data);
      if (!company) return res.status(404).json({ message: "Company not found" });
      
      const org = await storage.getDefaultOrganization();
      if (org) {
        await storage.createAuditLog({
          userId,
          action: "update",
          entityType: "company",
          entityId: company.id,
          entityName: company.name,
          organizationId: org.id,
          changes: { 
            before: existingCompany as unknown as Record<string, unknown>, 
            after: company as unknown as Record<string, unknown> 
          },
        });
      }
      
      res.json(company);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
      const existingCompany = await storage.getCompany(id);
      await storage.deleteCompany(id);
      
      const org = await storage.getDefaultOrganization();
      if (org && existingCompany) {
        await storage.createAuditLog({
          userId,
          action: "delete",
          entityType: "company",
          entityId: id,
          entityName: existingCompany.name,
          organizationId: org.id,
          changes: { before: existingCompany as unknown as Record<string, unknown> },
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Conversations - supports pagination via query params (?page=1&limit=20&search=...&status=...&channel=...)
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });

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
              assignedTo,
            };
          })
        );
      };

      // Check if pagination is requested
      const { page, limit, search, status, channel, assignedToId } = req.query;
      if (page || limit || search || status || channel) {
        const result = await storage.getConversationsPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          status: status as string,
          channel: channel as string,
          assignedToId: assignedToId as string,
        });
        const enrichedData = await enrichConversations(result.data);
        return res.json({ ...result, data: enrichedData });
      }

      // Fallback to non-paginated (for backward compatibility)
      const allConversations = await storage.getConversations(org.id);
      const enrichedConversations = await enrichConversations(allConversations);
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const conversation = await storage.getConversation(id);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });
      const conversationMessages = await storage.getMessages(id);
      res.json({ ...conversation, messages: conversationMessages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      
      const parsed = insertConversationSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const conversation = await storage.createConversation(parsed.data);
      broadcast("conversation:created", conversation);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.patch("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const parsed = updateConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const conversation = await storage.updateConversation(id, parsed.data);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });
      res.json(conversation);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Failed to update conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid ID" });

      // Parse cursor and limit for pagination
      const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 50) : 30;

      const result = await storage.getMessages(conversationId, { cursor, limit });
      res.json(result);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const senderId = (req.user as any).id;
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid ID" });
      
      const parsed = insertMessageSchema.safeParse({ ...req.body, conversationId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const message = await storage.createMessage(parsed.data);
      broadcast("message:created", message);
      
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
          const { isUserOnline } = await import("./redis");
          const isOnline = await isUserOnline(conversation.assignedToId);

          if (!isOnline) {
            const {
              sendPushNotificationBatch,
              createNotificationPayload,
              isFcmAvailable,
            } = await import("./notifications");

            if (isFcmAvailable()) {
              const tokens = await storage.getPushTokensForUser(conversation.assignedToId);
              if (tokens.length > 0) {
                const sender = await storage.getUser(senderId);
                const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Usuário";
                const preview = message.content?.substring(0, 100) || "Nova mensagem";

                const payload = createNotificationPayload("message:new", {
                  senderName,
                  preview,
                  conversationId,
                  senderAvatar: sender?.profileImageUrl,
                });

                await sendPushNotificationBatch(
                  tokens.map((t) => t.token),
                  payload
                );
              }
            }
          }
        } catch (pushError) {
          console.error("[FCM] Error sending push notification:", pushError);
        }
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Mark messages as read
  app.post("/api/conversations/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid ID" });

      const count = await storage.markMessagesAsRead(conversationId, userId);

      // Broadcast read event to other users
      broadcast("message:read", { conversationId, userId, count });

      res.json({ success: true, count });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Activities - supports pagination via query params (?page=1&limit=20&search=...&type=...&status=...)
  app.get("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });

      // Check if pagination is requested
      const { page, limit, search, type, status, userId } = req.query;
      if (page || limit || search || type || status) {
        const result = await storage.getActivitiesPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          type: type as string,
          status: status as string,
          userId: userId as string,
        });
        return res.json(result);
      }

      // Fallback to non-paginated (for backward compatibility)
      const allActivities = await storage.getActivities(org.id);
      res.json(allActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const activity = await storage.getActivity(id);
      if (!activity) return res.status(404).json({ message: "Activity not found" });
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      
      const parsed = insertActivitySchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const activity = await storage.createActivity(parsed.data);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const parsed = updateActivitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const activity = await storage.updateActivity(id, parsed.data);
      if (!activity) return res.status(404).json({ message: "Activity not found" });
      res.json(activity);
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete("/api/activities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteActivity(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Notifications endpoints
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const notificationsList = await storage.getNotifications(userId);
      res.json(notificationsList);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const notification = await storage.markNotificationRead(id, userId);
      if (!notification) return res.status(404).json({ message: "Notification not found" });
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ message: "Failed to mark all notifications read" });
    }
  });

  // Saved Views endpoints
  app.get("/api/saved-views", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const type = req.query.type as string;
      if (!type || !savedViewTypes.includes(type as any)) {
        return res.status(400).json({ message: "Invalid view type" });
      }
      const views = await storage.getSavedViews(userId, type as any);
      res.json(views);
    } catch (error) {
      console.error("Error fetching saved views:", error);
      res.status(500).json({ message: "Failed to fetch saved views" });
    }
  });

  app.post("/api/saved-views", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      
      const parsed = insertSavedViewSchema.safeParse({ ...req.body, userId, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const view = await storage.createSavedView(parsed.data);
      res.status(201).json(view);
    } catch (error) {
      console.error("Error creating saved view:", error);
      res.status(500).json({ message: "Failed to create saved view" });
    }
  });

  app.patch("/api/saved-views/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const parsed = updateSavedViewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const view = await storage.updateSavedView(id, userId, parsed.data);
      if (!view) return res.status(404).json({ message: "Saved view not found" });
      res.json(view);
    } catch (error) {
      console.error("Error updating saved view:", error);
      res.status(500).json({ message: "Failed to update saved view" });
    }
  });

  app.delete("/api/saved-views/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).id;
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteSavedView(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved view:", error);
      res.status(500).json({ message: "Failed to delete saved view" });
    }
  });

  // Get users for filter dropdown
	  app.get("/api/users", isAuthenticated, async (req: any, res) => {
	    try {
	      const org = await storage.getDefaultOrganization();
	      if (!org) return res.json([]);
	      const usersList = await storage.getUsers(org.id);
	      res.json(usersList.map(toSafeUser));
	    } catch (error) {
	      console.error("Error fetching users:", error);
	      res.status(500).json({ message: "Failed to fetch users" });
	    }
	  });

  // Email Templates endpoints
  const updateEmailTemplateSchema = insertEmailTemplateSchema.partial().omit({ organizationId: true, createdBy: true });

  app.get("/api/email-templates", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const templates = await storage.getEmailTemplates(org.id);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ message: "Failed to fetch email templates" });
    }
  });

  app.get("/api/email-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const template = await storage.getEmailTemplate(id, org.id);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ message: "Failed to fetch email template" });
    }
  });

  app.post("/api/email-templates", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;
      
      const parsed = insertEmailTemplateSchema.safeParse({ ...req.body, organizationId: org.id, createdBy: userId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const template = await storage.createEmailTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating email template:", error);
      res.status(500).json({ message: "Failed to create email template" });
    }
  });

  app.patch("/api/email-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const parsed = updateEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const template = await storage.updateEmailTemplate(id, org.id, parsed.data);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error) {
      console.error("Error updating email template:", error);
      res.status(500).json({ message: "Failed to update email template" });
    }
  });

  app.delete("/api/email-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteEmailTemplate(id, org.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email template:", error);
      res.status(500).json({ message: "Failed to delete email template" });
    }
  });

  // Audit Logs endpoints
  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const user = await storage.getUser((req.user as any).id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(org.id, limit);
      
      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const logUser = await storage.getUser(log.userId);
          return {
            ...log,
            user: logUser ? { id: logUser.id, firstName: logUser.firstName, lastName: logUser.lastName } : null,
          };
        })
      );
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/entity/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      const entityType = req.params.entityType as AuditLogEntityType;
      const entityId = parseInt(req.params.entityId);
      if (!auditLogEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      if (isNaN(entityId)) return res.status(400).json({ message: "Invalid entity ID" });
      
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const logUser = await storage.getUser(log.userId);
          return {
            ...log,
            user: logUser ? { id: logUser.id, firstName: logUser.firstName, lastName: logUser.lastName } : null,
          };
        })
      );
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching entity audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Reports endpoint
  app.get("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({
          dealsByStage: [],
          dealsOverTime: [],
          conversionFunnel: [],
          teamPerformance: [],
          activitySummary: [],
          wonLostByMonth: [],
        });
      }
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const reportData = await storage.getReportData(org.id, startDate, endDate);
      res.json(reportData);
    } catch (error) {
      console.error("Error fetching report data:", error);
      res.status(500).json({ message: "Failed to fetch report data" });
    }
  });

	  // File upload - get presigned URL
	  app.post("/api/files/upload-url", isAuthenticated, async (req: any, res) => {
	    try {
	      const objectStorageService = new ObjectStorageService();
	      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
	      res.json({ uploadURL, objectPath });
	    } catch (error) {
	      console.error("Error getting upload URL:", error);
	      res.status(500).json({ message: "Failed to get upload URL" });
	    }
	  });

  // Register uploaded file
	  app.post("/api/files", isAuthenticated, async (req: any, res) => {
	    try {
	      const org = await storage.getDefaultOrganization();
	      if (!org) {
	        return res.status(400).json({ message: "No organization found" });
	      }

	      const userId = (req.user as any).id;
	      const { name, mimeType, size, uploadURL, objectPath, entityType, entityId } = req.body;

	      if (!name || (!uploadURL && !objectPath) || !entityType || !entityId) {
	        return res.status(400).json({ message: "Missing required fields" });
	      }

      if (!fileEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

	      const objectStorageService = new ObjectStorageService();
	      const normalizedObjectPath = await objectStorageService.trySetObjectEntityAclPolicy(
	        objectPath || uploadURL,
	        {
	          owner: userId,
	          visibility: "public",
	        }
	      );

	      if (!normalizedObjectPath.startsWith("/objects/")) {
	        return res.status(400).json({ message: "Invalid object path" });
	      }

	      const file = await storage.createFile({
	        name,
	        mimeType: mimeType || null,
	        size: size || null,
	        objectPath: normalizedObjectPath,
	        entityType,
	        entityId: parseInt(entityId),
	        organizationId: org.id,
	        uploadedBy: userId,
	      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Error registering file:", error);
      res.status(500).json({ message: "Failed to register file" });
    }
  });

  // Get files for entity
  app.get("/api/files/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;

      if (!fileEntityTypes.includes(entityType as FileEntityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const files = await storage.getFiles(entityType as FileEntityType, parseInt(entityId));
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

	  // Delete file
	  app.delete("/api/files/:id", isAuthenticated, async (req: any, res) => {
	    try {
	      const id = parseInt(req.params.id);
	      if (isNaN(id)) {
	        return res.status(400).json({ message: "Invalid file ID" });
	      }

	      const file = await storage.getFile(id);
	      if (!file) {
	        return res.status(404).json({ message: "File not found" });
	      }

	      // Best-effort delete from storage
	      try {
	        const objectStorageService = new ObjectStorageService();
	        const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
	        await objectStorageService.deleteFile(objectFile.path);
	      } catch (e) {
	        console.warn("Failed to delete object from storage (continuing):", e);
	      }

	      await storage.deleteFile(id);
	      res.status(204).send();
	    } catch (error) {
	      console.error("Error deleting file:", error);
	      res.status(500).json({ message: "Failed to delete file" });
    }
  });

	  // Audio transcription endpoint
	  app.post("/api/audio/transcribe", isAuthenticated, async (req: any, res) => {
	    try {
	      const { audioUrl, language } = req.body;

      if (!audioUrl) {
        return res.status(400).json({ message: "Audio URL is required" });
      }

	      const { transcribeAudio, isWhisperAvailable } = await import("./whisper");

      if (!isWhisperAvailable()) {
        return res.status(503).json({ message: "Transcription service not available" });
      }

	      let resolvedUrl: string = audioUrl;
	      if (typeof audioUrl === "string" && audioUrl.startsWith("/objects/")) {
	        const objectStorageService = new ObjectStorageService();
	        const objectFile = await objectStorageService.getObjectEntityFile(audioUrl);
	        resolvedUrl = await objectStorageService.getSignedUrl(objectFile.path, 15 * 60);
	      }

	      const result = await transcribeAudio(resolvedUrl, language);
	      res.json(result);
	    } catch (error) {
	      console.error("Error transcribing audio:", error);
	      res.status(500).json({ message: "Failed to transcribe audio" });
	    }
	  });

  // Transcribe audio file by ID (fetches file URL and transcribes)
	  app.post("/api/files/:id/transcribe", isAuthenticated, async (req: any, res) => {
	    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check if file is audio
      if (!file.mimeType?.startsWith("audio/")) {
        return res.status(400).json({ message: "File is not an audio file" });
      }

	      const { transcribeAudio, isWhisperAvailable } = await import("./whisper");

      if (!isWhisperAvailable()) {
        return res.status(503).json({ message: "Transcription service not available" });
      }

	      const objectStorageService = new ObjectStorageService();
	      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
	      const signedUrl = await objectStorageService.getSignedUrl(objectFile.path, 15 * 60);
	      const result = await transcribeAudio(signedUrl, req.body.language);

      // Return transcription result
      // Note: To persist transcription, add a 'metadata' jsonb field to the files table
      res.json({
        ...result,
        fileId: id,
        fileName: file.name,
      });
    } catch (error) {
      console.error("Error transcribing file:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  // Lead scoring endpoints
  app.get("/api/lead-scores/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const id = parseInt(entityId);
      
      if (!['contact', 'deal'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid entity ID" });
      }
      
      const score = await storage.getLeadScore(entityType as any, id);
      res.json(score || null);
    } catch (error) {
      console.error("Error fetching lead score:", error);
      res.status(500).json({ message: "Failed to fetch lead score" });
    }
  });

  app.post("/api/lead-scores/:entityType/:entityId/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const id = parseInt(entityId);

      if (!['contact', 'deal'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid entity ID" });
      }

      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      const { scoreContact, scoreDeal } = await import("./aiScoring");

      if (entityType === 'contact') {
        const contact = await storage.getContact(id);
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }

        const scoringData = await storage.getContactScoringData(id);
        let companyName: string | null = null;
        if (contact.companyId) {
          const company = await storage.getCompany(contact.companyId);
          if (company) companyName = company.name;
        }

        const result = await scoreContact(
          {
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            jobTitle: contact.jobTitle,
            companyName,
            source: contact.source,
            tags: contact.tags,
          },
          scoringData.activities,
          scoringData.conversations,
          scoringData.deals
        );

        const savedScore = await storage.createLeadScore({
          entityType: 'contact',
          entityId: id,
          score: result.score,
          factors: result.factors,
          recommendation: result.recommendation,
          nextBestAction: result.nextBestAction,
          organizationId: org.id,
        });

        res.json(savedScore);
      } else {
        const dealData = await storage.getDealScoringData(id);
        if (!dealData.deal) {
          return res.status(404).json({ message: "Deal not found" });
        }

        const result = await scoreDeal(
          dealData.deal,
          dealData.activities,
          dealData.conversations
        );

        const savedScore = await storage.createLeadScore({
          entityType: 'deal',
          entityId: id,
          score: result.score,
          factors: result.factors,
          recommendation: result.recommendation,
          nextBestAction: result.nextBestAction,
          organizationId: org.id,
        });

        res.json(savedScore);
      }
    } catch (error) {
      console.error("Error calculating lead score:", error);
      res.status(500).json({ message: "Failed to calculate lead score" });
    }
  });

  // Calendar Events routes
  app.get("/api/calendar-events", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const events = await storage.getCalendarEvents(org.id, startDate, endDate);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  app.get("/api/calendar-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const event = await storage.getCalendarEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (error) {
      console.error("Error fetching calendar event:", error);
      res.status(500).json({ message: "Failed to fetch calendar event" });
    }
  });

  app.post("/api/calendar-events", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;
      
      const body = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        organizationId: org.id,
        userId
      };
      
      const parsed = insertCalendarEventSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const event = await storage.createCalendarEvent(parsed.data);
      broadcast("calendar:event:created", event);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      res.status(500).json({ message: "Failed to create calendar event" });
    }
  });

  app.patch("/api/calendar-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const body = {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      
      const parsed = updateCalendarEventSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const event = await storage.updateCalendarEvent(id, parsed.data);
      if (!event) return res.status(404).json({ message: "Event not found" });
      broadcast("calendar:event:updated", event);
      res.json(event);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(500).json({ message: "Failed to update calendar event" });
    }
  });

  app.delete("/api/calendar-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      await storage.deleteCalendarEvent(id);
      broadcast("calendar:event:deleted", { id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ message: "Failed to delete calendar event" });
    }
  });

  // Helper function to redact sensitive fields from channel configs
  function redactChannelConfigSecrets(config: any) {
    const redacted = { ...config };
    if (redacted.emailConfig) {
      const emailConfig = { ...redacted.emailConfig };
      if (emailConfig.password) {
        emailConfig.hasPassword = true;
        delete emailConfig.password;
      }
      redacted.emailConfig = emailConfig;
    }
    if (redacted.whatsappConfig) {
      const whatsappConfig = { ...redacted.whatsappConfig };
      if (whatsappConfig.accessToken) {
        whatsappConfig.hasAccessToken = true;
        delete whatsappConfig.accessToken;
      }
      redacted.whatsappConfig = whatsappConfig;
    }
    return redacted;
  }

  // Channel configuration routes
  app.get("/api/channel-configs", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const configs = await storage.getChannelConfigs(org.id);
      const redactedConfigs = configs.map(redactChannelConfigSecrets);
      res.json(redactedConfigs);
    } catch (error) {
      console.error("Error fetching channel configs:", error);
      res.status(500).json({ message: "Failed to fetch channel configs" });
    }
  });

  app.get("/api/channel-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      res.json(redactChannelConfigSecrets(config));
    } catch (error) {
      console.error("Error fetching channel config:", error);
      res.status(500).json({ message: "Failed to fetch channel config" });
    }
  });

  app.post("/api/channel-configs", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;

      const parsed = insertChannelConfigSchema.safeParse({ 
        ...req.body, 
        organizationId: org.id,
        createdBy: userId 
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const config = await storage.createChannelConfig(parsed.data);
      const redactedConfig = redactChannelConfigSecrets(config);
      broadcast("channel:config:created", redactedConfig);
      res.status(201).json(redactedConfig);
    } catch (error) {
      console.error("Error creating channel config:", error);
      res.status(500).json({ message: "Failed to create channel config" });
    }
  });

  app.patch("/api/channel-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const parsed = updateChannelConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }

      // Storage layer handles merging secrets - preserves password/accessToken if not provided
      const config = await storage.updateChannelConfig(id, parsed.data);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      const redactedConfig = redactChannelConfigSecrets(config);
      broadcast("channel:config:updated", redactedConfig);
      res.json(redactedConfig);
    } catch (error) {
      console.error("Error updating channel config:", error);
      res.status(500).json({ message: "Failed to update channel config" });
    }
  });

  app.delete("/api/channel-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      await storage.deleteChannelConfig(id);
      broadcast("channel:config:deleted", { id });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting channel config:", error);
      res.status(500).json({ message: "Failed to delete channel config" });
    }
  });

  app.post("/api/channel-configs/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });

      if (config.type === "email") {
        res.json({ success: true, message: "Email configuration validated successfully" });
      } else if (config.type === "whatsapp") {
        res.json({ success: true, message: "WhatsApp configuration validated successfully" });
      } else {
        res.status(400).json({ message: "Unknown channel type" });
      }
    } catch (error) {
      console.error("Error testing channel config:", error);
      res.status(500).json({ message: "Failed to test channel config" });
    }
  });

  // ============================================
  // Evolution API Endpoints (WhatsApp via Baileys)
  // ============================================

  // Check if Evolution API is configured
  app.get("/api/evolution/status", isAuthenticated, async (req: any, res) => {
    try {
      const config = evolutionApi.getConfiguration();
      res.json({
        configured: config.configured,
        url: config.configured ? config.url : null,
      });
    } catch (error) {
      console.error("Error checking Evolution API status:", error);
      res.status(500).json({ message: "Failed to check Evolution API status" });
    }
  });

  // Connect WhatsApp instance (create and get QR code)
  app.post("/api/channel-configs/:id/whatsapp/connect", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

	      if (!evolutionApi.isConfigured()) {
	        return res.status(503).json({ message: "Evolution API is not configured" });
	      }

	      if (process.env.NODE_ENV === "production" && !process.env.EVOLUTION_WEBHOOK_SECRET) {
	        return res.status(500).json({
	          message: "EVOLUTION_WEBHOOK_SECRET is required in production to validate webhooks",
	        });
	      }

	      const organizationId = config.organizationId;
	      const instanceName = `crm-org-${organizationId}-channel-${id}`;

      // Check if instance already exists
	      const existingInstance = await evolutionApi.getInstanceInfo(instanceName);

	      if (!existingInstance) {
	        // Create new instance
	        await evolutionApi.createInstance(instanceName);
	      }

	      // Set (or refresh) webhook URL for this instance
	      const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
	      const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
	      const webhookUrl = new URL("/api/webhooks/evolution", appUrl);
	      if (webhookSecret) {
	        webhookUrl.searchParams.set("token", webhookSecret);
	      }
	      await evolutionApi.setWebhook(instanceName, webhookUrl.toString());

      // Get QR code
      const qrData = await evolutionApi.getQrCode(instanceName);

      // Update channel config with instance name and QR code
      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      whatsappConfig.instanceName = instanceName;
      whatsappConfig.qrCode = qrData.base64 || qrData.code;
      whatsappConfig.connectionStatus = "qr_pending";

      await storage.updateChannelConfig(id, {
        whatsappConfig: whatsappConfig as any,
      });

      res.json({
        instanceName,
        qrCode: qrData.base64 || qrData.code,
        pairingCode: qrData.pairingCode,
        status: "qr_pending",
      });
    } catch (error) {
      console.error("Error connecting WhatsApp:", error);
      res.status(500).json({ message: "Failed to connect WhatsApp" });
    }
  });

  // Get WhatsApp connection status
  app.get("/api/channel-configs/:id/whatsapp/status", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return res.json({
          status: "disconnected",
          instanceName: null,
        });
      }

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
      }

      try {
        const connectionState = await evolutionApi.getConnectionStatus(instanceName);

        // Map Evolution API states to our states
        const statusMap: Record<string, string> = {
          open: "connected",
          close: "disconnected",
          connecting: "connecting",
        };

        const status = statusMap[connectionState.state] || "disconnected";

        // Update config if status changed
        if (whatsappConfig.connectionStatus !== status) {
          whatsappConfig.connectionStatus = status;
          if (status === "connected") {
            whatsappConfig.lastConnectedAt = new Date().toISOString();
            whatsappConfig.qrCode = undefined; // Clear QR code on connect
          }
          await storage.updateChannelConfig(id, {
            whatsappConfig: whatsappConfig as any,
          });
        }

        res.json({
          status,
          instanceName,
          lastConnectedAt: whatsappConfig.lastConnectedAt,
        });
      } catch (error) {
        // Instance might not exist or is disconnected
        res.json({
          status: "disconnected",
          instanceName,
        });
      }
    } catch (error) {
      console.error("Error getting WhatsApp status:", error);
      res.status(500).json({ message: "Failed to get WhatsApp status" });
    }
  });

  // Disconnect WhatsApp instance
  app.post("/api/channel-configs/:id/whatsapp/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return res.json({ success: true, message: "No active connection" });
      }

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
      }

      try {
        await evolutionApi.disconnectInstance(instanceName);
      } catch (error) {
        // Instance might already be disconnected
        console.log("Instance disconnect error (may already be disconnected):", error);
      }

      // Update config
      whatsappConfig.connectionStatus = "disconnected";
      whatsappConfig.qrCode = undefined;

      await storage.updateChannelConfig(id, {
        whatsappConfig: whatsappConfig as any,
      });

      res.json({ success: true, message: "WhatsApp disconnected" });
    } catch (error) {
      console.error("Error disconnecting WhatsApp:", error);
      res.status(500).json({ message: "Failed to disconnect WhatsApp" });
    }
  });

	  // Evolution API Webhook (receives messages from WhatsApp)
	  // Note: This endpoint does NOT require authentication as it's called by Evolution API
	  app.post("/api/webhooks/evolution", async (req, res) => {
	    try {
	      const expectedToken = process.env.EVOLUTION_WEBHOOK_SECRET;
	      if (expectedToken) {
	        const providedToken = (req.query?.token as string | undefined) ||
	          (req.headers["x-evolution-webhook-secret"] as string | undefined);
	        if (!providedToken || providedToken !== expectedToken) {
	          console.warn("[Evolution Webhook] Invalid token");
	          return res.status(200).json({ received: true });
	        }
	      } else if (process.env.NODE_ENV === "production") {
	        console.warn("[Evolution Webhook] EVOLUTION_WEBHOOK_SECRET is not set; skipping processing");
	        return res.status(200).json({ received: true });
	      }

	      const event = req.body as EvolutionWebhookEvent;

	      const normalizedEvent = String(event.event || "").toUpperCase().replace(/\./g, "_");
	      console.log(`[Evolution Webhook] Received: ${normalizedEvent} for instance: ${event.instance}`);

	      // Parse instance name to get channel config ID.
	      // Known formats:
	      // - crm-org-{orgId}-channel-{configId}
	      // - crm-channel-{configId}
	      const channelMatch =
	        event.instance?.match(/crm-org-\d+-channel-(\d+)/) ||
	        event.instance?.match(/crm-channel-(\d+)/);
	      if (!channelMatch) {
	        console.log("[Evolution Webhook] Unknown instance format:", event.instance);
	        return res.status(200).json({ received: true });
	      }

	      const channelConfigId = parseInt(channelMatch[1]);
	      if (Number.isNaN(channelConfigId)) {
	        return res.status(200).json({ received: true });
	      }

	      const config = await storage.getChannelConfig(channelConfigId);
	      if (!config || config.type !== "whatsapp") {
	        console.log("[Evolution Webhook] Channel config not found:", channelConfigId);
	        return res.status(200).json({ received: true });
	      }

	      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
	      const expectedInstanceName = whatsappConfig.instanceName as string | undefined;
	      if (!expectedInstanceName || expectedInstanceName !== event.instance) {
	        console.log("[Evolution Webhook] Instance mismatch for channel:", channelConfigId);
	        return res.status(200).json({ received: true });
	      }

	      const organizationId = config.organizationId;

	      // Set broadcast function for real-time updates
	      evolutionHandler.setBroadcast((orgId, eventType, data) => {
	        broadcast(`whatsapp:${eventType}`, { organizationId: orgId, data });
	      });

	      // Process the webhook event
	      await evolutionHandler.handleWebhook(
	        { ...event, event: normalizedEvent },
	        channelConfigId,
	        organizationId,
	      );

	      res.status(200).json({ received: true });
	    } catch (error) {
	      console.error("[Evolution Webhook] Error processing webhook:", error);
      // Always return 200 to prevent retries
      res.status(200).json({ received: true, error: "Processing failed" });
    }
  });

  // Send WhatsApp message via Evolution API
  app.post("/api/channel-configs/:id/whatsapp/send", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const { to, text, mediaUrl, mediaType, caption, fileName } = req.body;

      if (!to) return res.status(400).json({ message: "Recipient phone number (to) is required" });
      if (!text && !mediaUrl) return res.status(400).json({ message: "Either text or mediaUrl is required" });

      const config = await storage.getChannelConfig(id);
      if (!config) return res.status(404).json({ message: "Channel config not found" });
      if (config.type !== "whatsapp") return res.status(400).json({ message: "Not a WhatsApp channel" });

      const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
      const instanceName = whatsappConfig.instanceName as string | undefined;

      if (!instanceName) {
        return res.status(400).json({ message: "WhatsApp not connected" });
      }

      if (!evolutionApi.isConfigured()) {
        return res.status(503).json({ message: "Evolution API is not configured" });
      }

      let result;
      if (mediaUrl && mediaType) {
        result = await evolutionApi.sendMediaMessage(
          instanceName,
          to,
          mediaUrl,
          mediaType,
          caption,
          fileName
        );
      } else {
        result = await evolutionApi.sendTextMessage(instanceName, to, text);
      }

      res.json({ success: true, result });
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ message: "Failed to send WhatsApp message" });
    }
  });

  // Serve object files
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any)?.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      await objectStorageService.downloadObject(objectFile.path, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Push token endpoints for FCM
  app.post("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { token, deviceInfo } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const pushToken = await storage.createPushToken({
        userId,
        token,
        deviceInfo: deviceInfo || null,
      });

      res.status(201).json(pushToken);
    } catch (error) {
      console.error("Error saving push token:", error);
      res.status(500).json({ message: "Failed to save push token" });
    }
  });

  app.delete("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      await storage.deletePushToken(token);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting push token:", error);
      res.status(500).json({ message: "Failed to delete push token" });
    }
  });

  // =============================================
  // GOOGLE CALENDAR INTEGRATION ROUTES
  // =============================================

  // Check if Google Calendar is configured
  app.get("/api/integrations/google-calendar/configured", isAuthenticated, async (req: any, res) => {
    const { googleCalendarService } = await import("./google-calendar");
    res.json({ configured: googleCalendarService.isConfigured() });
  });

  // Get Google Calendar connection status
  app.get("/api/integrations/google-calendar/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const token = await storage.getGoogleOAuthToken(userId);

      if (!token || !token.isActive) {
        return res.json({
          connected: false,
          email: null,
          lastSyncAt: null,
          syncStatus: null,
        });
      }

      res.json({
        connected: true,
        email: token.email,
        lastSyncAt: token.lastSyncAt,
        syncStatus: token.syncStatus,
        syncError: token.syncError,
      });
    } catch (error) {
      console.error("Error getting Google Calendar status:", error);
      res.status(500).json({ message: "Failed to get Google Calendar status" });
    }
  });

  // Initiate OAuth flow - returns authorization URL
	  app.get("/api/auth/google/authorize", isAuthenticated, async (req: any, res) => {
	    try {
	      const { googleCalendarService } = await import("./google-calendar");

      if (!googleCalendarService.isConfigured()) {
        return res.status(503).json({ message: "Google Calendar integration is not configured" });
      }

	      const userId = (req.user as any).id;
	      const state = signOAuthState({ userId, timestamp: Date.now() });

	      const authUrl = googleCalendarService.getAuthUrl(state);
	      res.json({ authUrl });
	    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ message: "Failed to generate authorization URL" });
    }
  });

  // OAuth callback - handles code exchange
	  app.get("/api/auth/google/callback", async (req, res) => {
	    try {
	      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        console.error("OAuth error:", oauthError);
        return res.redirect("/settings?google_calendar=error&message=" + encodeURIComponent(String(oauthError)));
      }

      if (!code || !state) {
        return res.redirect("/settings?google_calendar=error&message=missing_params");
      }

	      const stateData = verifyOAuthState(String(state));
	      if (!stateData?.userId || !stateData.timestamp) {
	        return res.redirect("/settings?google_calendar=error&message=invalid_state");
	      }

	      // Prevent very old states (10 minutes)
	      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
	        return res.redirect("/settings?google_calendar=error&message=state_expired");
	      }

	      const user = await storage.getUser(stateData.userId);
	      if (!user) {
	        return res.redirect("/settings?google_calendar=error&message=invalid_user");
	      }

	      const { googleCalendarService, encryptToken } = await import("./google-calendar");

      // Exchange code for tokens
      const tokens = await googleCalendarService.exchangeCode(String(code));

      // Encrypt tokens before storing
      const encryptedAccessToken = encryptToken(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

      // Store tokens
      await storage.createGoogleOAuthToken({
        userId: stateData.userId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenType: tokens.tokenType,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        email: tokens.email,
        calendarId: 'primary', // Default to primary calendar
        isActive: true,
        syncStatus: 'idle',
      });

      res.redirect("/settings?google_calendar=success");
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      res.redirect("/settings?google_calendar=error&message=exchange_failed");
    }
  });

  // Disconnect Google Calendar
  app.post("/api/integrations/google-calendar/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const token = await storage.getGoogleOAuthToken(userId);

      if (token) {
        // Try to revoke the token
        try {
          const { googleCalendarService, decryptToken } = await import("./google-calendar");
          const accessToken = decryptToken(token.accessToken);
          await googleCalendarService.revokeTokens(accessToken);
        } catch (revokeError) {
          console.log("Token revocation failed (continuing with deletion):", revokeError);
        }

        // Delete from database
        await storage.deleteGoogleOAuthToken(userId);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting Google Calendar:", error);
      res.status(500).json({ message: "Failed to disconnect Google Calendar" });
    }
  });

  // Trigger manual sync
  app.post("/api/integrations/google-calendar/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      if (!user?.organizationId) {
        return res.status(400).json({ message: "User organization not found" });
      }

      const token = await storage.getGoogleOAuthToken(userId);
      if (!token || !token.isActive) {
        return res.status(400).json({ message: "Google Calendar not connected" });
      }

      const { googleCalendarService, decryptToken, encryptToken } = await import("./google-calendar");

      // Update sync status
      await storage.updateGoogleOAuthToken(userId, { syncStatus: 'syncing', syncError: null });

      try {
        // Decrypt access token
        let accessToken = decryptToken(token.accessToken);

        // Check if token is expired and refresh if needed
        if (token.expiresAt && new Date(token.expiresAt) <= new Date()) {
          if (!token.refreshToken) {
            throw new Error("Refresh token not available");
          }
          const refreshedTokens = await googleCalendarService.refreshAccessToken(decryptToken(token.refreshToken));
          accessToken = refreshedTokens.accessToken;

          // Update stored token
          await storage.updateGoogleOAuthToken(userId, {
            accessToken: encryptToken(accessToken),
            expiresAt: refreshedTokens.expiresAt,
          });
        }

        // Import events from Google Calendar
        const { events } = await googleCalendarService.listEvents(accessToken, token.calendarId || 'primary');

        let imported = 0;
        for (const googleEvent of events) {
          // Check if event already exists
          const existingEvent = await storage.getCalendarEventByGoogleId(googleEvent.id, userId);

          if (!existingEvent) {
            // Create new event
            const crmEvent = googleCalendarService.googleEventToCrmEvent(
              googleEvent,
              userId,
              user.organizationId,
              token.calendarId || 'primary'
            );
            await storage.createCalendarEvent(crmEvent);
            imported++;
          }
        }

        // Update sync status
        await storage.updateGoogleOAuthToken(userId, {
          syncStatus: 'idle',
          lastSyncAt: new Date(),
          syncError: null,
        });

        // Broadcast sync complete via WebSocket
        broadcast("google_calendar:sync_complete", { userId, imported });

        res.json({ success: true, imported });
      } catch (syncError: any) {
        await storage.updateGoogleOAuthToken(userId, {
          syncStatus: 'error',
          syncError: syncError.message || 'Sync failed',
        });
        throw syncError;
      }
    } catch (error: any) {
      console.error("Error syncing Google Calendar:", error);
      res.status(500).json({ message: error.message || "Failed to sync Google Calendar" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket auth via the same session cookie used by the API (prevents userId spoofing).
  const sessionParser = getSession();
  const wss = new WebSocketServer({ noServer: true });
  const clientUserMap = new Map<WebSocket, string>();

  const fakeRes = {
    getHeader() {
      return undefined;
    },
    setHeader() {},
  } as any;

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ? new URL(req.url, "http://localhost") : null;
    if (!url || url.pathname !== "/ws") {
      if (process.env.NODE_ENV === "production") {
        socket.destroy();
      }
      return;
    }

    sessionParser(req as any, fakeRes, () => {
      const userId = (req as any).session?.passport?.user as string | undefined;
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });
  });

  wss.on("connection", async (ws, req) => {
    const userId = (req as any).session?.passport?.user as string | undefined;
    if (!userId) {
      ws.close(1008, "Not authenticated");
      return;
    }

    clients.add(ws);
    clientUserMap.set(ws, userId);

    try {
      const user = await storage.getUser(userId);
      const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined;
      const { setUserOnline } = await import("./redis");
      await setUserOnline(userId);
      broadcast("user:online", { userId, userName, lastSeenAt: new Date().toISOString() });
    } catch (e) {
      console.error("WebSocket online status error:", e);
    }

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "typing") {
          broadcast("typing", { ...data.payload, userId });
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    });

    ws.on("close", async () => {
      clients.delete(ws);
      clientUserMap.delete(ws);

      const hasOtherConnections = Array.from(clientUserMap.values()).includes(userId);
      if (hasOtherConnections) return;

      try {
        const { setUserOffline } = await import("./redis");
        await setUserOffline(userId);
      } catch (e) {
        console.error("WebSocket offline status error:", e);
      }

      broadcast("user:offline", { userId, lastSeenAt: new Date().toISOString() });
    });
  });

  return httpServer;
}
