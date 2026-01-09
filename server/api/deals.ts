import type { Express } from "express";
import { z } from "zod";
import { insertDealSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

const updateDealSchema = insertDealSchema.partial().omit({ organizationId: true });
const moveDealSchema = z.object({ stageId: z.number() });

export function registerDealRoutes(app: Express) {
  // Deals - supports pagination via query params (?page=1&limit=20&search=...&pipelineId=...&status=...)
  app.get("/api/deals", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
      }

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
            after: deal as unknown as Record<string, unknown>,
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
}

