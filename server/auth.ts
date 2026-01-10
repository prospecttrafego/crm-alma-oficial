/**
 * Modulo de autenticacao local com Passport.js
 * Substitui a autenticacao Replit por email/senha
 */
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db, pool } from "./db";
import { users, pipelines, pipelineStages } from "@shared/schema";
import { and, count, eq } from "drizzle-orm";
import { getSingleTenantOrganizationId } from "./tenant";
import { checkRateLimit } from "./redis";
import { logger } from "./logger";

const BCRYPT_ROUNDS = 12;

// Password reset token configuration
const PASSWORD_RESET_TOKEN_BYTES = 32; // 32 bytes = 64 hex characters
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1; // Token expires in 1 hour

/**
 * Generate a secure random token for password reset
 */
function generateSecureToken(): string {
  return crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
}

// ========== RATE LIMITING ==========

/**
 * Rate limiting para login: 5 tentativas por minuto por IP
 * Mais restritivo que o rate limit geral para proteger contra brute force
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 minuto

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
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

function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
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

// ========== POLITICA DE SENHA ==========

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida senha com regras robustas:
 * - Minimo 8 caracteres
 * - Pelo menos 1 letra maiuscula
 * - Pelo menos 1 numero
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Senha deve ter no minimo 8 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Senha deve conter pelo menos 1 letra maiuscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Senha deve conter pelo menos 1 numero");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

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
    return res.status(429).json({
      message: "Muitas requisicoes. Tente novamente em alguns segundos.",
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    });
  }

  next();
};

/**
 * Configura middleware de sessao com PostgreSQL
 */
export function getSession() {
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000; // 1 semana
  const sessionTtlSec = Math.ceil(sessionTtlMs / 1000);
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: false,
    ttl: sessionTtlSec,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtlMs,
      sameSite: "lax",
    },
  });
}

/**
 * Configura autenticacao com Passport Local Strategy
 */
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Estrategia Local: autenticacao por email/senha
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()));

          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Credenciais invalidas" });
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Credenciais invalidas" });
          }

          // Enforce single-tenant org membership (auto-fix legacy users with NULL org)
          const tenantOrganizationId = await getSingleTenantOrganizationId();
          if (!user.organizationId) {
            await db
              .update(users)
              .set({ organizationId: tenantOrganizationId, updatedAt: new Date() })
              .where(eq(users.id, user.id));
            user.organizationId = tenantOrganizationId;
          } else if (user.organizationId !== tenantOrganizationId) {
            return done(null, false, { message: "Credenciais invalidas" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serializacao do usuario na sessao
  passport.serializeUser((user: Express.User, cb) => {
    cb(null, (user as any).id);
  });

  // Deserializacao do usuario da sessao
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await storage.getUser(id);
      cb(null, user || null);
    } catch (error) {
      cb(error);
    }
  });

  // Endpoint: Login (com rate limiting anti-brute-force)
  app.post("/api/login", (req, res, next) => {
    const clientIp = getClientIp(req);
    const rateLimitCheck = checkLoginRateLimit(clientIp);

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        message: `Muitas tentativas de login. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
        retryAfter: rateLimitCheck.retryAfter,
      });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro interno do servidor" });
      }
      if (!user) {
        // Nao resetar contador em caso de falha (brute force protection)
        return res.status(401).json({ message: info?.message || "Credenciais invalidas" });
      }

      // Login bem-sucedido: resetar contador de tentativas
      resetLoginAttempts(clientIp);

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Erro ao iniciar sessao" });
        }
        // Nao retornar passwordHash na resposta
        const { passwordHash, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  // Endpoint: Registro (configuravel via env, com rate limiting)
  app.post("/api/register", async (req, res) => {
    try {
      // Rate limiting para registro (mesmo mecanismo do login)
      const clientIp = getClientIp(req);
      const rateLimitCheck = checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          message: `Muitas tentativas. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          retryAfter: rateLimitCheck.retryAfter,
        });
      }

      const allowRegistration = process.env.ALLOW_REGISTRATION === "true";
      if (!allowRegistration) {
        return res.status(403).json({ message: "Registro desabilitado. Contate o administrador." });
      }

      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha sao obrigatorios" });
      }

      // Validacao de senha robusta
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: "Senha invalida",
          errors: passwordValidation.errors,
        });
      }

      // Verificar se usuario ja existe
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existing) {
        return res.status(409).json({ message: "Email ja cadastrado" });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const tenantOrganizationId = await getSingleTenantOrganizationId();

      // Determine role: first user becomes admin, the rest are sales by default.
      const [orgUserCount] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.organizationId, tenantOrganizationId));
      const isFirstUserInOrg = Number(orgUserCount?.count || 0) === 0;

      // Criar usuario associado a organizacao default (single tenant)
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          firstName: firstName || null,
          lastName: lastName || null,
          organizationId: tenantOrganizationId,
          role: isFirstUserInOrg ? "admin" : "sales",
        })
        .returning();

      // Ensure at least one default pipeline exists for the tenant org.
      const [existingDefaultPipeline] = await db
        .select({ id: pipelines.id })
        .from(pipelines)
        .where(and(eq(pipelines.organizationId, tenantOrganizationId), eq(pipelines.isDefault, true)))
        .limit(1);

      if (!existingDefaultPipeline) {
        const [defaultPipeline] = await db
          .insert(pipelines)
          .values({
            name: "Pipeline de Vendas",
            organizationId: tenantOrganizationId,
            isDefault: true,
          })
          .returning();

        const defaultStages = [
          { name: "Novo Lead", order: 0, color: "#6B7280" },
          { name: "Qualificado", order: 1, color: "#3B82F6" },
          { name: "Proposta", order: 2, color: "#F59E0B" },
          { name: "Negociacao", order: 3, color: "#8B5CF6" },
          { name: "Fechado (Ganho)", order: 4, color: "#10B981", isWon: true },
          { name: "Fechado (Perdido)", order: 5, color: "#EF4444", isLost: true },
        ];

        await db.insert(pipelineStages).values(
          defaultStages.map((stage) => ({
            ...stage,
            pipelineId: defaultPipeline.id,
          })),
        );
      }

      // Auto-login apos registro
      req.logIn(newUser, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Erro ao iniciar sessao" });
        }
        const { passwordHash: _, ...safeUser } = newUser;
        return res.status(201).json(safeUser);
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  // Endpoint: Forgot Password (request password reset)
  app.post("/api/forgot-password", async (req, res) => {
    try {
      // Rate limiting (same as login to prevent enumeration)
      const clientIp = getClientIp(req);
      const rateLimitCheck = checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          message: `Muitas tentativas. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          retryAfter: rateLimitCheck.retryAfter,
        });
      }

      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email e obrigatorio" });
      }

      // Always return success to prevent email enumeration attacks
      const successResponse = {
        message: "Se o email estiver cadastrado, voce recebera instrucoes para redefinir sua senha.",
      };

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (!user) {
        // Don't reveal that user doesn't exist
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return res.json(successResponse);
      }

      // Generate token and expiry
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Store token
      await storage.createPasswordResetToken({
        token,
        userId: user.id,
        expiresAt,
      });

      // In production, you would send an email here
      // For now, log the reset URL (for development/testing)
      const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      if (process.env.NODE_ENV !== "production") {
        logger.info(`Password reset URL for ${email}: ${resetUrl}`);
      }

      // TODO: Send email with resetUrl when email service is configured
      // await sendPasswordResetEmail(user.email, resetUrl);

      logger.info(`Password reset token generated for user: ${user.id}`);
      return res.json(successResponse);
    } catch (error) {
      logger.error("Erro no forgot-password:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Erro ao processar solicitacao" });
    }
  });

  // Endpoint: Reset Password (apply new password with token)
  app.post("/api/reset-password", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = getClientIp(req);
      const rateLimitCheck = checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          message: `Muitas tentativas. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          retryAfter: rateLimitCheck.retryAfter,
        });
      }

      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token e nova senha sao obrigatorios" });
      }

      // Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: "Senha invalida",
          errors: passwordValidation.errors,
        });
      }

      // Find valid token
      const resetToken = await storage.getValidPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Token invalido ou expirado" });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await storage.markPasswordResetTokenUsed(token);

      logger.info(`Password reset completed for user: ${resetToken.userId}`);

      return res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      logger.error("Erro no reset-password:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  // Endpoint: Logout
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao encerrar sessao" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  // Endpoint: Usuario atual
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Nao autenticado" });
    }
    const { passwordHash, ...safeUser } = req.user as any;
    res.json(safeUser);
  });
}

/**
 * Middleware: verifica se usuario esta autenticado
 */
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Nao autorizado" });
  }
  next();
};

/**
 * Middleware: verifica role do usuario
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Nao autorizado" });
    }

    const user = req.user as any;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    next();
  };
}
