import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
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

const clients = new Set<WebSocket>();

function broadcast(type: string, data: unknown) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const updateDealSchema = insertDealSchema.partial().omit({ organizationId: true });
const updateContactSchema = insertContactSchema.partial().omit({ organizationId: true });
const updateCompanySchema = insertCompanySchema.partial().omit({ organizationId: true });
const updateActivitySchema = insertActivitySchema.partial().omit({ organizationId: true });
const updateConversationSchema = insertConversationSchema.partial().omit({ organizationId: true });
const updateSavedViewSchema = insertSavedViewSchema.partial().omit({ userId: true, organizationId: true, type: true });
const moveDealSchema = z.object({ stageId: z.number() });
const updateCalendarEventSchema = insertCalendarEventSchema.partial().omit({ organizationId: true });
const updateChannelConfigSchema = insertChannelConfigSchema.partial().omit({ organizationId: true, type: true });

export async function registerRoutes(
  app: Express
): Promise<Server> {
  await setupAuth(app);

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  app.post("/api/pipelines", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });
      const userId = (req.user as any).id;
      
      const parsed = insertPipelineSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const pipeline = await storage.createPipeline(parsed.data);
      
      if (req.body.stages && Array.isArray(req.body.stages)) {
        for (const stage of req.body.stages) {
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

  app.patch("/api/pipelines/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const userId = (req.user as any).id;
      
      const existing = await storage.getPipeline(id);
      if (!existing) return res.status(404).json({ message: "Pipeline not found" });
      
      const pipeline = await storage.updatePipeline(id, req.body);
      
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

  app.delete("/api/pipelines/:id", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/pipelines/:id/set-default", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/pipelines/:id/stages", isAuthenticated, async (req: any, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      if (isNaN(pipelineId)) return res.status(400).json({ message: "Invalid pipeline ID" });
      
      const parsed = insertPipelineStageSchema.safeParse({ ...req.body, pipelineId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      
      const stage = await storage.createPipelineStage(parsed.data);
      broadcast("pipeline:stage:created", stage);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating pipeline stage:", error);
      res.status(500).json({ message: "Failed to create pipeline stage" });
    }
  });

  app.patch("/api/pipelines/:pipelineId/stages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      
      const stage = await storage.updatePipelineStage(id, req.body);
      broadcast("pipeline:stage:updated", stage);
      res.json(stage);
    } catch (error) {
      console.error("Error updating pipeline stage:", error);
      res.status(500).json({ message: "Failed to update pipeline stage" });
    }
  });

  app.delete("/api/pipelines/:pipelineId/stages/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/deals", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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

  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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

  app.get("/api/companies", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const allConversations = await storage.getConversations(org.id);
      
      // Enrich with contact (including company), deal, and assignedTo relations
      const enrichedConversations = await Promise.all(
        allConversations.map(async (conv) => {
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
            // If no company from contact, try to get from deal
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
      const conversationMessages = await storage.getMessages(conversationId);
      res.json(conversationMessages);
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.get("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
      res.json(usersList);
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
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
      const { name, mimeType, size, uploadURL, entityType, entityId } = req.body;

      if (!name || !uploadURL || !entityType || !entityId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!fileEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        uploadURL,
        {
          owner: userId,
          visibility: "public",
        }
      );

      const file = await storage.createFile({
        name,
        mimeType: mimeType || null,
        size: size || null,
        objectPath,
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

      await storage.deleteFile(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
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

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "typing") {
          broadcast("typing", data.payload);
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  return httpServer;
}
