import type { Express } from "express";
import { insertCalendarEventSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

const updateCalendarEventSchema = insertCalendarEventSchema.partial().omit({ organizationId: true });

export function registerCalendarEventRoutes(app: Express) {
  app.get("/api/calendar-events", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
        userId,
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
}

