/**
 * Standardized API Response Utilities
 * Provides consistent response formatting across all endpoints
 */

import type { Response } from "express";

// Standard API response structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

// Standard pagination response
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Error codes for consistent error handling
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Rate Limiting
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Integration Errors
  INTEGRATION_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
  INTEGRATION_ERROR: "INTEGRATION_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Send a successful response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      requestId: (res.req as any).requestId,
      timestamp: new Date().toISOString(),
    },
  };
  res.status(statusCode).json(response);
}

/**
 * Send a successful response with pagination
 */
export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  pagination: PaginatedApiResponse<T>["pagination"]
): void {
  const response: PaginatedApiResponse<T> = {
    success: true,
    data,
    pagination,
    meta: {
      requestId: (res.req as any).requestId,
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: unknown
): void {
  const error: ApiResponse["error"] = {
    code,
    message,
  };
  if (details !== undefined) {
    error.details = details;
  }

  const response: ApiResponse = {
    success: false,
    error,
    meta: {
      requestId: (res.req as any).requestId,
      timestamp: new Date().toISOString(),
    },
  };
  res.status(statusCode).json(response);
}

// Convenience error response functions
export const sendUnauthorized = (res: Response, message: string = "Não autorizado") =>
  sendError(res, ErrorCodes.UNAUTHORIZED, message, 401);

export const sendForbidden = (res: Response, message: string = "Acesso negado") =>
  sendError(res, ErrorCodes.FORBIDDEN, message, 403);

export const sendNotFound = (res: Response, message: string = "Recurso não encontrado") =>
  sendError(res, ErrorCodes.NOT_FOUND, message, 404);

export const sendValidationError = (res: Response, message: string, details?: unknown) =>
  sendError(res, ErrorCodes.VALIDATION_ERROR, message, 400, details);

export const sendConflict = (res: Response, message: string) =>
  sendError(res, ErrorCodes.CONFLICT, message, 409);

export const sendRateLimited = (res: Response, retryAfter?: number) =>
  sendError(
    res,
    ErrorCodes.RATE_LIMITED,
    `Muitas requisições. Tente novamente em ${retryAfter || "alguns"} segundos.`,
    429
  );

export const sendInternalError = (res: Response, message: string = "Erro interno do servidor") =>
  sendError(res, ErrorCodes.INTERNAL_ERROR, message, 500);

export const sendIntegrationError = (res: Response, service: string, message: string) =>
  sendError(res, ErrorCodes.INTEGRATION_ERROR, `Erro na integração ${service}: ${message}`, 502);
