import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler } from "../middleware";
import { sendSuccess } from "../response";

export function registerDashboardRoutes(app: Express) {
  app.get(
    "/api/dashboard/stats",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendSuccess(res, {
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
      sendSuccess(res, stats);
    })
  );
}
