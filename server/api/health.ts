import type { Express } from "express";
import { performHealthCheck } from "../health";

export function registerHealthRoutes(app: Express) {
  // Health check endpoint (publico, sem autenticacao)
  app.get("/api/health", async (_req, res) => {
    try {
      const health = await performHealthCheck();
      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (_error) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      });
    }
  });
}

