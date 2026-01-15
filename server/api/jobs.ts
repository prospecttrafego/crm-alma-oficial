/**
 * Jobs API Module
 * Endpoints for querying background job status
 */

import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated, requireRole } from "../auth";
import { getJob, getJobStatus, getQueueStats, cleanupJobs } from "../jobs/queue";
import { asyncHandler, validateParams, validateBody } from "../middleware";
import { sendSuccess, sendNotFound } from "../response";

// Schemas de validacao
const jobIdParamsSchema = z.object({
  id: z.string().min(1),
});

const cleanupBodySchema = z.object({
  maxAgeMs: z.number().int().positive().optional(),
});

export function registerJobRoutes(app: Express) {
  // Get queue stats (admin only) - must be before :id route
  app.get(
    "/api/jobs/stats",
    isAuthenticated,
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      const stats = await getQueueStats();
      sendSuccess(res, stats);
    })
  );

  // Get job by ID
  app.get(
    "/api/jobs/:id",
    isAuthenticated,
    validateParams(jobIdParamsSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const job = await getJob(id);

      if (!job) {
        return sendNotFound(res, "Job not found");
      }

      sendSuccess(res, {
        id: job.id,
        type: job.type,
        status: job.status,
        result: job.status === "completed" ? job.result : undefined,
        error: job.status === "failed" ? job.error : undefined,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
    })
  );

  // Get job status only (lightweight)
  app.get(
    "/api/jobs/:id/status",
    isAuthenticated,
    validateParams(jobIdParamsSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const status = await getJobStatus(id);

      if (!status) {
        return sendNotFound(res, "Job not found");
      }

      sendSuccess(res, { id, status });
    })
  );

  // Cleanup old jobs (admin only)
  app.post(
    "/api/jobs/cleanup",
    isAuthenticated,
    requireRole("admin"),
    validateBody(cleanupBodySchema),
    asyncHandler(async (req, res) => {
      const maxAgeMs = req.validatedBody?.maxAgeMs || 24 * 60 * 60 * 1000; // Default 24 hours
      const removed = await cleanupJobs(maxAgeMs);
      sendSuccess(res, { removed });
    })
  );
}
