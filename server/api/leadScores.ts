import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { enqueueJob } from "../jobs/queue";
import { JobTypes, type CalculateLeadScorePayload } from "../jobs/handlers";

export function registerLeadScoreRoutes(app: Express) {
  app.get("/api/lead-scores/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const id = parseInt(entityId);

      if (!["contact", "deal"].includes(entityType)) {
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
      const async = req.query.async === "true";

      if (!["contact", "deal"].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid entity ID" });
      }

      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Verify entity exists before queueing
      if (entityType === "contact") {
        const contact = await storage.getContact(id);
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
      } else {
        const dealData = await storage.getDealScoringData(id);
        if (!dealData.deal) {
          return res.status(404).json({ message: "Deal not found" });
        }
      }

      // Async mode: queue the job and return immediately
      if (async) {
        const payload: CalculateLeadScorePayload = {
          entityType: entityType as "contact" | "deal",
          entityId: id,
          organizationId: org.id,
        };

        const job = enqueueJob(JobTypes.CALCULATE_LEAD_SCORE, payload);

        return res.status(202).json({
          message: "Lead score calculation queued",
          jobId: job.id,
          status: job.status,
        });
      }

      // Sync mode: calculate immediately
      const { scoreContact, scoreDeal } = await import("../integrations/openai/scoring");

      if (entityType === "contact") {
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
          scoringData.deals,
        );

        const savedScore = await storage.createLeadScore({
          entityType: "contact",
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

        const result = await scoreDeal(dealData.deal, dealData.activities, dealData.conversations);

        const savedScore = await storage.createLeadScore({
          entityType: "deal",
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
}

