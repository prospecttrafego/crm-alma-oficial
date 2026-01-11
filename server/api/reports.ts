import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler } from "../middleware";
import { sendSuccess } from "../response";

export function registerReportRoutes(app: Express) {
  app.get(
    "/api/reports",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendSuccess(res, {
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
      sendSuccess(res, reportData);
    })
  );
}
