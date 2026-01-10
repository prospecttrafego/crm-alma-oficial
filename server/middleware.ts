/**
 * Centralized Middleware Module
 * Re-exports all middleware for consistent usage across the app
 */

import type { RequestHandler, ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { sendValidationError, sendError, sendNotFound, ErrorCodes, type ErrorCode } from "./response";
import { logger } from "./logger";

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
    } catch (_error) {
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

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.values(ErrorCodes).includes(value as ErrorCode);
}

function getErrorCodeForStatus(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCodes.INVALID_INPUT;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMITED;
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    default:
      return ErrorCodes.INTERNAL_ERROR;
  }
}

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns a consistent response
 * - Logs full error details on the server
 * - Returns user-friendly message without stack traces
 */
export const globalErrorHandler: ErrorRequestHandler = (
  err: Error & { status?: number; statusCode?: number; code?: string },
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  // Log the full error with context
  const errorContext = {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    userId: (req.user as any)?.id,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
  };

  // Determine if this is a known/handled error or unexpected
  const statusCode = err.statusCode || err.status || 500;
  const isInternalError = statusCode >= 500;

  if (isInternalError) {
    // Log as error for 500s
    logger.error("Unhandled error", errorContext);
  } else {
    // Log as warning for 4xx (these are usually client errors)
    logger.warn("Request error", errorContext);
  }

  // Don't expose internal details in production
  const isProduction = process.env.NODE_ENV === "production";
  const userMessage =
    isProduction && isInternalError
      ? "Ocorreu um erro interno. Por favor, tente novamente mais tarde."
      : err.message || "Erro interno do servidor";

  const code = isErrorCode(err.code) ? err.code : getErrorCodeForStatus(statusCode);
  sendError(res, code, userMessage, statusCode);
};

/**
 * 404 Not Found handler
 * Should be registered after all routes
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendNotFound(res, `Rota não encontrada: ${req.method} ${req.path}`);
};
