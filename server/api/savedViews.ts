import type { Express } from "express";
import { insertSavedViewSchema, savedViewTypes } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const updateSavedViewSchema = insertSavedViewSchema
  .partial()
  .omit({ userId: true, organizationId: true, type: true });

export function registerSavedViewRoutes(app: Express) {
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
}

