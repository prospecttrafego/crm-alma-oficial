/**
 * Standardized API Response Utilities
 * Provides consistent response formatting across all endpoints
 *
 * Types are imported from shared/types/api.ts to ensure consistency
 * between frontend and backend
 */

import type { Response } from "express";

// Re-export types from shared for convenience
export type {
  ApiResponse,
  PaginatedResponse,
  ApiError,
  ValidationError,
  ResponseMeta,
  PaginationMeta,
  ErrorCode,
} from "@shared/types/api";

export { ErrorCodes } from "@shared/types/api";

// Import types for internal use
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
  ErrorCode,
} from "@shared/types/api";
import { ErrorCodes } from "@shared/types/api";

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
  pagination: PaginationMeta
): void {
  const response: PaginatedResponse<T> = {
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
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details: details as any }),
    },
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

export const sendServiceUnavailable = (res: Response, message: string = "Serviço indisponível") =>
  sendError(res, ErrorCodes.SERVICE_UNAVAILABLE, message, 503);

// User utility - strips sensitive fields
export function toSafeUser<T extends { passwordHash?: unknown }>(user: T) {
  if (!user) return user;
  const { passwordHash: _passwordHash, ...safeUser } = user as any;
  return safeUser as Omit<T, "passwordHash">;
}
