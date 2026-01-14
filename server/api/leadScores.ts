import type { Express } from "express";
import { z } from "zod";
import { leadScoreEntityTypes, type LeadScoreEntityType } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { enqueueJob } from "../jobs/queue";
import { JobTypes, type CalculateLeadScorePayload } from "../jobs/handlers";
import { asyncHandler, validateParams, validateQuery } from "../middleware";
import { sendSuccess, sendNotFound, sendValidationError } from "../response";

// Schemas de validacao
const leadScoreParamsSchema = z.object({
  entityType: z.string(),
  entityId: z.coerce.number().int().positive(),
});

const asyncQuerySchema = z.object({
  async: z.string().optional(),
});

export function registerLeadScoreRoutes(app: Express) {
  // Get lead score for entity
  app.get(
    "/api/lead-scores/:entityType/:entityId",
    isAuthenticated,
    validateParams(leadScoreParamsSchema),
    asyncHandler(async (req: any, res) => {
      const { entityType, entityId } = req.validatedParams;

      if (!leadScoreEntityTypes.includes(entityType as LeadScoreEntityType)) {
        return sendValidationError(res, "Invalid entity type");
      }

      const score = await storage.getLeadScore(entityType as LeadScoreEntityType, entityId);
      sendSuccess(res, score || null);
    })
  );

  // Calculate lead score for entity
  app.post(
    "/api/lead-scores/:entityType/:entityId/calculate",
    isAuthenticated,
    validateParams(leadScoreParamsSchema),
    validateQuery(asyncQuerySchema),
    asyncHandler(async (req: any, res) => {
      const { entityType, entityId } = req.validatedParams;
      const isAsync = req.validatedQuery?.async === "true";

      if (!leadScoreEntityTypes.includes(entityType as LeadScoreEntityType)) {
        return sendValidationError(res, "Invalid entity type");
      }

      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendNotFound(res, "Organization not found");
      }

      // Verify entity exists before queueing
      if (entityType === "contact") {
        const contact = await storage.getContact(entityId);
        if (!contact) {
          return sendNotFound(res, "Contact not found");
        }
      } else {
        const dealData = await storage.getDealScoringData(entityId);
        if (!dealData.deal) {
          return sendNotFound(res, "Deal not found");
        }
      }

      // Async mode: queue the job and return immediately
      if (isAsync) {
        const payload: CalculateLeadScorePayload = {
          entityType: entityType as "contact" | "deal",
          entityId,
          organizationId: org.id,
        };

        const job = await enqueueJob(JobTypes.CALCULATE_LEAD_SCORE, payload);

        return sendSuccess(
          res,
          {
            message: "Lead score calculation queued",
            jobId: job.id,
            status: job.status,
          },
          202
        );
      }

      // Sync mode: calculate immediately
      const { scoreContact, scoreDeal } = await import("../integrations/openai/scoring");

      if (entityType === "contact") {
        const contact = await storage.getContact(entityId);
        if (!contact) {
          return sendNotFound(res, "Contact not found");
        }

        const scoringData = await storage.getContactScoringData(entityId);
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
          entityType: "contact",
          entityId,
          score: result.score,
          factors: result.factors,
          recommendation: result.recommendation,
          nextBestAction: result.nextBestAction,
          organizationId: org.id,
        });

        sendSuccess(res, savedScore);
      } else {
        const dealData = await storage.getDealScoringData(entityId);
        if (!dealData.deal) {
          return sendNotFound(res, "Deal not found");
        }

        const result = await scoreDeal(dealData.deal, dealData.activities, dealData.conversations);

        const savedScore = await storage.createLeadScore({
          entityType: "deal",
          entityId,
          score: result.score,
          factors: result.factors,
          recommendation: result.recommendation,
          nextBestAction: result.nextBestAction,
          organizationId: org.id,
        });

        sendSuccess(res, savedScore);
      }
    })
  );
}
