import type { Express } from "express";
import { insertActivitySchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const updateActivitySchema = insertActivitySchema.partial().omit({ organizationId: true });

export function registerActivityRoutes(app: Express) {
  // Activities - supports pagination via query params (?page=1&limit=20&search=...&type=...&status=...)
  app.get("/api/activities", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
      }

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
}

