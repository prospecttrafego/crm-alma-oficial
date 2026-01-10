/**
 * Jobs API Module
 * Endpoints for querying background job status
 */

import type { Express } from "express";
import { isAuthenticated, requireRole } from "../auth";
import { getJob, getJobStatus, getQueueStats, cleanupJobs } from "../jobs/queue";

export function registerJobRoutes(app: Express) {
  // Get job by ID
  app.get("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const job = getJob(id);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json({
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
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Get job status only (lightweight)
  app.get("/api/jobs/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const status = getJobStatus(id);

      if (!status) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json({ id, status });
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ message: "Failed to fetch job status" });
    }
  });

  // Get queue stats (admin only)
  app.get("/api/jobs/stats", isAuthenticated, requireRole("admin"), async (_req: any, res) => {
    try {
      const stats = getQueueStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching queue stats:", error);
      res.status(500).json({ message: "Failed to fetch queue stats" });
    }
  });

  // Cleanup old jobs (admin only)
  app.post("/api/jobs/cleanup", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const maxAgeMs = req.body.maxAgeMs || 24 * 60 * 60 * 1000; // Default 24 hours
      const removed = cleanupJobs(maxAgeMs);
      res.json({ removed });
    } catch (error) {
      console.error("Error cleaning up jobs:", error);
      res.status(500).json({ message: "Failed to cleanup jobs" });
    }
  });
}
