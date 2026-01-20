/**
 * Auth module facade
 * Keeps public exports stable while internal files stay small and focused.
 */
import passport from "passport";
import type { Express } from "express";
import { getSession } from "./auth/session";
import { configurePassport } from "./auth/passport";
import { registerAuthRoutes } from "./auth/routes";

export { getSession } from "./auth/session";
export { rateLimitMiddleware } from "./auth/rate-limit";
export { isAuthenticated, requireRole, csrfProtection } from "./auth/middleware";

/**
 * Initialize auth stack: session, passport, and routes.
 */
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport();
  registerAuthRoutes(app);
}
