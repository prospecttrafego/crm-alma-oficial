import type { Express } from "express";
import { performHealthCheck } from "../health";
import { asyncHandler } from "../middleware";
import { sendSuccess, sendError, ErrorCodes } from "../response";

export function registerHealthRoutes(app: Express) {
  // Liveness check (publico, sem autenticacao). Nao depende do banco.
  app.get("/api/healthz", (_req, res) => {
    sendSuccess(res, {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Health check endpoint (publico, sem autenticacao)
  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      const health = await performHealthCheck();
      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

      if (statusCode === 503) {
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, "Service unhealthy", 503, health);
      }
      sendSuccess(res, health);
    })
  );
}
