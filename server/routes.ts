import type { Express } from "express";
import { createServer, type Server } from "http";
import { getSession, rateLimitMiddleware, setupAuth } from "./auth";
import { registerApiRoutes } from "./api/index";
import { setupWebSocketServer } from "./ws/index";
import { sentryUserMiddleware } from "./lib/sentry";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // Add Sentry user context after auth setup
  app.use(sentryUserMiddleware);

  // Rate limiting (apenas para /api autenticado; nao afeta webhooks/health)
  app.use("/api", (req: any, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/webhooks/")) {
      return next();
    }
    if (req.isAuthenticated?.()) {
      return rateLimitMiddleware(req, res, next);
    }
    next();
  });

  registerApiRoutes(app);

  const httpServer = createServer(app);

  // WebSocket auth via the same session cookie used by the API (prevents userId spoofing).
  const sessionParser = getSession();
  setupWebSocketServer(httpServer, sessionParser);

  return httpServer;
}

