import type { Express } from "express";
import { performHealthCheck } from "../health";
import { asyncHandler } from "../middleware";
import { sendSuccess, sendError, ErrorCodes } from "../response";
import { logger } from "../logger";

export function registerHealthRoutes(app: Express) {
  // Liveness check (publico, sem autenticacao). Nao depende do banco.
  app.get("/api/healthz", (_req, res) => {
    sendSuccess(res, {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Health check endpoint (protegido)
  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      const req = _req as any;
      const secret = process.env.HEALTH_CHECK_SECRET;
      const headerToken = req.headers["x-health-check-secret"] as string | undefined;
      const authHeader = req.headers.authorization as string | undefined;
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
      const hasValidSecret = !!secret && (headerToken === secret || bearerToken === secret);

      const isAdmin = req.isAuthenticated?.() && req.user?.role === "admin";

      if (!hasValidSecret && !isAdmin) {
        logger.warn("[Health] Unauthorized access attempt", { ip: req.ip });
        return sendError(res, ErrorCodes.UNAUTHORIZED, "Unauthorized", 401);
      }

      const health = await performHealthCheck();
      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

      if (statusCode === 503) {
        return sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, "Service unhealthy", 503, health);
      }
      sendSuccess(res, health);
    })
  );
}
