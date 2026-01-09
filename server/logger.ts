/**
 * Structured Logging Module
 * Logs estruturados com requestId para rastreabilidade
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";

// Estender Request para incluir requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  organizationId?: number;
  service?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

/**
 * Formata e emite log estruturado
 */
function emitLog(level: LogLevel, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  // Em producao, usar JSON para integracao com ferramentas de log
  // Em desenvolvimento, usar formato legivel
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const output = JSON.stringify(entry);
    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  } else {
    // Formato legivel para desenvolvimento
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    switch (level) {
      case "error":
        console.error(`${prefix} ${message}${contextStr}`);
        break;
      case "warn":
        console.warn(`${prefix} ${message}${contextStr}`);
        break;
      default:
        console.log(`${prefix} ${message}${contextStr}`);
    }
  }
}

/**
 * Logger principal
 */
export const logger = {
  debug: (message: string, context?: LogContext) => emitLog("debug", message, context),
  info: (message: string, context?: LogContext) => emitLog("info", message, context),
  warn: (message: string, context?: LogContext) => emitLog("warn", message, context),
  error: (message: string, context?: LogContext) => emitLog("error", message, context),
};

/**
 * Middleware que adiciona requestId a cada requisicao
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  // Usar X-Request-ID do header se existir (para load balancers)
  const existingId = req.headers["x-request-id"];
  req.requestId = typeof existingId === "string" ? existingId : randomUUID();

  // Adicionar requestId ao header de resposta
  res.setHeader("X-Request-ID", req.requestId);

  next();
};

/**
 * Middleware de logging de requests HTTP
 */
export const requestLoggingMiddleware: RequestHandler = (req, res, next) => {
  const start = Date.now();

  // Log ao finalizar a request
  res.on("finish", () => {
    const duration = Date.now() - start;
    const user = req.user as any;

    // Nao logar health checks em producao para evitar ruido
    if (req.path === "/api/health" && process.env.NODE_ENV === "production") {
      return;
    }

    const context: LogContext = {
      requestId: req.requestId,
      duration,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
    };

    if (user?.id) {
      context.userId = user.id;
    }
    if (user?.organizationId) {
      context.organizationId = user.organizationId;
    }

    // Determinar nivel de log baseado no status
    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.path} - ${res.statusCode}`, context);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} - ${res.statusCode}`, context);
    } else {
      logger.info(`${req.method} ${req.path} - ${res.statusCode}`, context);
    }
  });

  next();
};

/**
 * Criar logger com contexto fixo (para servicos especificos)
 */
export function createServiceLogger(service: string) {
  return {
    debug: (message: string, context?: Omit<LogContext, "service">) =>
      logger.debug(message, { ...context, service }),
    info: (message: string, context?: Omit<LogContext, "service">) =>
      logger.info(message, { ...context, service }),
    warn: (message: string, context?: Omit<LogContext, "service">) =>
      logger.warn(message, { ...context, service }),
    error: (message: string, context?: Omit<LogContext, "service">) =>
      logger.error(message, { ...context, service }),
  };
}

// Loggers pre-configurados para servicos
export const whatsappLogger = createServiceLogger("whatsapp");
export const googleLogger = createServiceLogger("google-calendar");
export const openaiLogger = createServiceLogger("openai");
export const supabaseLogger = createServiceLogger("supabase");
