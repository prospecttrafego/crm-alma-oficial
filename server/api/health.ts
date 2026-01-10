import type { Express } from "express";
import { performHealthCheck } from "../health";

export function registerHealthRoutes(app: Express) {
  // Liveness check (publico, sem autenticacao). Nao depende do banco.
  app.get("/api/healthz", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

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
