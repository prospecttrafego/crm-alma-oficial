import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

export function registerReportRoutes(app: Express) {
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

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const reportData = await storage.getReportData(org.id, startDate, endDate);
      res.json(reportData);
    } catch (error) {
      console.error("Error fetching report data:", error);
      res.status(500).json({ message: "Failed to fetch report data" });
    }
  });
}

