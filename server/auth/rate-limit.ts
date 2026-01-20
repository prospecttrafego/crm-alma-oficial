import type { Request, RequestHandler } from "express";
import {
  checkRateLimit,
  checkLoginRateLimit as checkLoginRateLimitRedis,
  resetLoginRateLimit as resetLoginRateLimitRedis,
} from "../redis";
import { logger } from "../logger";
import { sendError, ErrorCodes } from "../response";
import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  MAX_LOGIN_ATTEMPTS_ENTRIES,
} from "../constants";

// ========== RATE LIMITING ==========

/**
 * Rate limiting para login: 5 tentativas por minuto por IP
 * Mais restritivo que o rate limit geral para proteger contra brute force
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return "unknown";
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}

export function getClientIp(req: Request): string {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return normalizeIp(req.ips[0]);
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return normalizeIp(forwarded[0]);
  }
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return normalizeIp(forwarded.split(",")[0].trim());
  }

  return normalizeIp(req.ip || req.socket.remoteAddress || "unknown");
}

function checkLoginRateLimitLocal(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    // Before adding new entry, check Map size to prevent memory exhaustion
    if (!record && loginAttempts.size >= MAX_LOGIN_ATTEMPTS_ENTRIES) {
      // First, try to clean up expired entries
      const entries = Array.from(loginAttempts.entries());
      for (const [key, val] of entries) {
        if (now > val.resetAt) {
          loginAttempts.delete(key);
        }
        // Stop early if we've freed enough space
        if (loginAttempts.size < MAX_LOGIN_ATTEMPTS_ENTRIES * 0.9) {
          break;
        }
      }

      // If still at capacity after cleanup, fail closed for safety
      if (loginAttempts.size >= MAX_LOGIN_ATTEMPTS_ENTRIES) {
        logger.warn("[Auth] Login attempts Map at capacity, failing closed", {
          mapSize: loginAttempts.size,
          maxSize: MAX_LOGIN_ATTEMPTS_ENTRIES,
          ip: ip.substring(0, 8) + "...", // Log partial IP for debugging
        });
        return { allowed: false, retryAfter: 60 };
      }
    }

    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

function resetLoginAttemptsLocal(ip: string): void {
  loginAttempts.delete(ip);
}

export async function checkLoginRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redisResult = await checkLoginRateLimitRedis(ip);
  if (redisResult) {
    return redisResult;
  }
  return checkLoginRateLimitLocal(ip);
}

export function resetLoginAttempts(ip: string): void {
  resetLoginAttemptsLocal(ip);
  void resetLoginRateLimitRedis(ip);
}

// Limpar registros antigos periodicamente
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(loginAttempts.entries());
  for (const [ip, record] of entries) {
    if (now > record.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}, 60 * 1000); // A cada minuto

// ========== MIDDLEWARE DE RATE LIMITING GERAL ==========

/**
 * Middleware de rate limiting usando Redis (100 req/min por usuario)
 * Funciona sem Redis (permite todas as requisicoes)
 */
export const rateLimitMiddleware: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  const identifier = user?.id || getClientIp(req);

  const result = await checkRateLimit(identifier);

  // Adicionar headers de rate limit
  res.setHeader("X-RateLimit-Limit", result.limit);
  res.setHeader("X-RateLimit-Remaining", result.remaining);
  res.setHeader("X-RateLimit-Reset", result.reset);

  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return sendError(
      res,
      ErrorCodes.RATE_LIMITED,
      "Muitas requisicoes. Tente novamente em alguns segundos.",
      429,
      { retryAfter }
    );
  }

  next();
};
