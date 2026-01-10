/**
 * Centralized Middleware Module
 * Re-exports all middleware for consistent usage across the app
 */

import type { RequestHandler } from "express";
import { z } from "zod";
import { sendValidationError, sendUnauthorized, sendForbidden, sendRateLimited } from "./response";

// Re-export existing middlewares
export { isAuthenticated, requireRole, rateLimitMiddleware } from "./auth";
export { requestIdMiddleware, requestLoggingMiddleware } from "./logger";

/**
 * Validate request body against a Zod schema
 * Returns parsed data in req.validatedBody
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return sendValidationError(res, "Dados inválidos", errors);
    }

    (req as any).validatedBody = result.data;
    next();
  };
}

/**
 * Validate request query parameters against a Zod schema
 * Returns parsed data in req.validatedQuery
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return sendValidationError(res, "Parâmetros inválidos", errors);
    }

    (req as any).validatedQuery = result.data;
    next();
  };
}

/**
 * Validate request params against a Zod schema
 * Returns parsed data in req.validatedParams
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return sendValidationError(res, "Parâmetros de rota inválidos", errors);
    }

    (req as any).validatedParams = result.data;
    next();
  };
}

/**
 * Require a specific feature/integration to be configured
 * Useful for optional integrations like WhatsApp, Google Calendar, etc.
 */
export function requireIntegration(
  integrationName: string,
  checkFn: () => boolean | Promise<boolean>
): RequestHandler {
  return async (req, res, next) => {
    try {
      const isConfigured = await checkFn();
      if (!isConfigured) {
        return res.status(503).json({
          success: false,
          error: {
            code: "INTEGRATION_NOT_CONFIGURED",
            message: `Integração ${integrationName} não está configurada`,
          },
        });
      }
      next();
    } catch (error) {
      return res.status(503).json({
        success: false,
        error: {
          code: "INTEGRATION_ERROR",
          message: `Erro ao verificar integração ${integrationName}`,
        },
      });
    }
  };
}

/**
 * Wrap async route handlers to catch errors
 * Prevents unhandled promise rejections from crashing the server
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Get the current user from request
 * Typed helper for accessing authenticated user
 */
export function getCurrentUser(req: any): { id: string; email: string; role: string; organizationId: number } | null {
  if (!req.isAuthenticated?.() || !req.user) {
    return null;
  }
  return req.user as any;
}

/**
 * Get organization ID from current user
 */
export function getOrganizationId(req: any): number | null {
  const user = getCurrentUser(req);
  return user?.organizationId ?? null;
}
