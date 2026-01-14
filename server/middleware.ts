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

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
};

/**
 * Validate request body against a Zod schema
 * Returns parsed data in req.validatedBody
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      // organizationId is server-managed; reject any client attempts to set/modify it
      if ("organizationId" in req.body) {
        return sendValidationError(
          res,
          "O campo 'organizationId' é gerenciado pelo servidor e não pode ser modificado pelo cliente.",
          [{ path: "organizationId", message: "Campo não permitido em requisições de cliente" }]
        );
      }
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return sendValidationError(res, "Dados inválidos", errors);
    }

    req.validatedBody = result.data;
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

    req.validatedQuery = result.data;
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

    req.validatedParams = result.data;
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
        return sendError(
          res,
          ErrorCodes.INTEGRATION_NOT_CONFIGURED,
          `Integração ${integrationName} não está configurada`,
          503
        );
      }
      next();
    } catch (_error) {
      return sendError(
        res,
        ErrorCodes.INTEGRATION_ERROR,
        `Erro ao verificar integração ${integrationName}`,
        503
      );
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
 * Returns null if user is not authenticated or missing required fields
 */
export function getCurrentUser(req: Request): { id: string; email: string; role: string; organizationId: number } | null {
  if (!req.isAuthenticated?.() || !req.user) {
    return null;
  }
  // Ensure required fields are present (use == to catch both null and undefined)
  if (!req.user.email || !req.user.role || req.user.organizationId == null) {
    return null;
  }
  return {
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    organizationId: req.user.organizationId,
  };
}

/**
 * Get organization ID from current user
 */
export function getOrganizationId(req: Request): number | null {
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
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
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
