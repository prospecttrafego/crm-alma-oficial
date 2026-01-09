import type { Express } from "express";
import { insertEmailTemplateSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const updateEmailTemplateSchema = insertEmailTemplateSchema
  .partial()
  .omit({ organizationId: true, createdBy: true });

export function registerEmailTemplateRoutes(app: Express) {
  // Email Templates endpoints
  app.get("/api/email-templates", isAuthenticated, async (_req: any, res) => {
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
}

