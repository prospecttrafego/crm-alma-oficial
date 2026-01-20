import type { Request, RequestHandler } from "express";
import { sendForbidden, sendUnauthorized } from "../response";

/**
 * Middleware: verifica se usuario esta autenticado
 */
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return sendUnauthorized(res, "Nao autorizado");
  }
  next();
};

/**
 * Middleware: verifica role do usuario
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return sendUnauthorized(res, "Nao autorizado");
    }

    const user = req.user as any;
    if (!roles.includes(user.role)) {
      return sendForbidden(res, "Acesso negado");
    }
    next();
  };
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(req: Request): string[] {
  const allowed: string[] = [];

  if (process.env.APP_URL) {
    const appUrl = process.env.APP_URL.split(",").map((url) => url.trim()).filter(Boolean);
    for (const url of appUrl) {
      const origin = normalizeOrigin(url);
      if (origin) {
        allowed.push(origin);
      }
    }
  }

  const host = req.get("host");
  if (host) {
    const forwardedProto = req.get("x-forwarded-proto");
    const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : req.protocol;
    allowed.push(`${proto}://${host}`);
  }

  return Array.from(new Set(allowed));
}

function isSameOrigin(requestOrigin: string, allowedOrigins: string[]): boolean {
  const normalized = normalizeOrigin(requestOrigin);
  if (!normalized) return false;
  return allowedOrigins.includes(normalized);
}

/**
 * CSRF protection for session-based requests.
 * Enforces Origin/Referer checks for state-changing methods.
 */
export const csrfProtection: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return next();
  }

  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins(req);
  if (allowedOrigins.length === 0) {
    return next();
  }

  const origin = req.get("origin");
  if (origin) {
    if (isSameOrigin(origin, allowedOrigins)) {
      return next();
    }
    return sendForbidden(res, "CSRF check failed (origin mismatch)");
  }

  const referer = req.get("referer");
  if (referer) {
    if (isSameOrigin(referer, allowedOrigins)) {
      return next();
    }
    return sendForbidden(res, "CSRF check failed (referer mismatch)");
  }

  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  return sendForbidden(res, "CSRF check failed (missing origin)");
};
