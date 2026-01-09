import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

export function registerDashboardRoutes(app: Express) {
  app.get("/api/dashboard/stats", isAuthenticated, async (_req: any, res) => {
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
}

