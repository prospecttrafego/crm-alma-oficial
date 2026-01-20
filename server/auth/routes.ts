import crypto from "crypto";
import passport from "passport";
import type { Express } from "express";
import { and, count, eq } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { users, pipelines, pipelineStages, passwordResetTokens } from "@shared/schema";
import { getSingleTenantOrganizationId } from "../tenant";
import { logger } from "../logger";
import { sendSuccess, sendError, ErrorCodes } from "../response";
import {
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
} from "../constants";
import { validatePassword, hashPassword } from "./password-policy";
import { checkLoginRateLimit, resetLoginAttempts, getClientIp } from "./rate-limit";

/**
 * Generate a secure random token for password reset
 */
function generateSecureToken(): string {
  return crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
}

function loginAndRespond(req: any, res: any, user: any, status = 200) {
  const completeLogin = () => {
    req.logIn(user, (loginErr: Error | null) => {
      if (loginErr) {
        return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro ao iniciar sessao", 500);
      }
      const { passwordHash: _passwordHash, ...safeUser } = user;
      return sendSuccess(res, safeUser, status);
    });
  };

  if (req.session?.regenerate) {
    req.session.regenerate((err: Error | null) => {
      if (err) {
        return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro ao iniciar sessao", 500);
      }
      completeLogin();
    });
  } else {
    completeLogin();
  }
}

export function registerAuthRoutes(app: Express) {
  // Endpoint: Login (com rate limiting anti-brute-force)
  app.post("/api/login", async (req, res, next) => {
    try {
      const clientIp = getClientIp(req);
      const rateLimitCheck = await checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return sendError(
          res,
          ErrorCodes.RATE_LIMITED,
          `Muitas tentativas de login. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          429,
          { retryAfter: rateLimitCheck.retryAfter }
        );
      }

      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro interno do servidor", 500);
        }
        if (!user) {
          // Nao resetar contador em caso de falha (brute force protection)
          return sendError(
            res,
            ErrorCodes.UNAUTHORIZED,
            info?.message || "Credenciais invalidas",
            401
          );
        }

        // Login bem-sucedido: resetar contador de tentativas
        resetLoginAttempts(clientIp);

        return loginAndRespond(req, res, user);
      })(req, res, next);
    } catch (error) {
      logger.error("Erro no login:", { error: error instanceof Error ? error.message : String(error) });
      return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro interno do servidor", 500);
    }
  });

  // Endpoint: Registro (configuravel via env, com rate limiting)
  app.post("/api/register", async (req, res) => {
    try {
      // Rate limiting para registro (mesmo mecanismo do login)
      const clientIp = getClientIp(req);
      const rateLimitCheck = await checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return sendError(
          res,
          ErrorCodes.RATE_LIMITED,
          `Muitas tentativas. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          429,
          { retryAfter: rateLimitCheck.retryAfter }
        );
      }

      const allowRegistration = process.env.ALLOW_REGISTRATION === "true";
      if (!allowRegistration) {
        return sendError(
          res,
          ErrorCodes.FORBIDDEN,
          "Registro desabilitado. Contate o administrador.",
          403
        );
      }

      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return sendError(
          res,
          ErrorCodes.INVALID_INPUT,
          "Email e senha sao obrigatorios",
          400
        );
      }

      // Validacao de senha robusta
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return sendError(
          res,
          ErrorCodes.INVALID_INPUT,
          "Senha invalida",
          400,
          { errors: passwordValidation.errors }
        );
      }

      // Verificar se usuario ja existe
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (existing) {
        return sendError(res, ErrorCodes.CONFLICT, "Email ja cadastrado", 409);
      }

      // Hash da senha
      const passwordHash = await hashPassword(password);

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
          }))
        );
      }

      // Auto-login apos registro (com nova sessao)
      resetLoginAttempts(clientIp);
      return loginAndRespond(req, res, newUser, 201);
    } catch (error) {
      logger.error("Erro no registro:", { error: error instanceof Error ? error.message : String(error) });
      return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro ao criar conta", 500);
    }
  });

  // Endpoint: Forgot Password (request password reset)
  app.post("/api/forgot-password", async (req, res) => {
    try {
      // Rate limiting (same as login to prevent enumeration)
      const clientIp = getClientIp(req);
      const rateLimitCheck = await checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return sendError(
          res,
          ErrorCodes.RATE_LIMITED,
          `Muitas tentativas. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          429,
          { retryAfter: rateLimitCheck.retryAfter }
        );
      }

      const { email } = req.body;

      if (!email) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Email e obrigatorio", 400);
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
        return sendSuccess(res, successResponse);
      }

      // Generate token and expiry
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

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
      return sendSuccess(res, successResponse);
    } catch (error) {
      logger.error("Erro no forgot-password:", { error: error instanceof Error ? error.message : String(error) });
      return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro ao processar solicitacao", 500);
    }
  });

  // Endpoint: Reset Password (apply new password with token)
  app.post("/api/reset-password", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = getClientIp(req);
      const rateLimitCheck = await checkLoginRateLimit(clientIp);

      if (!rateLimitCheck.allowed) {
        return sendError(
          res,
          ErrorCodes.RATE_LIMITED,
          `Muitas tentativas. Tente novamente em ${rateLimitCheck.retryAfter} segundos.`,
          429,
          { retryAfter: rateLimitCheck.retryAfter }
        );
      }

      const { token, password } = req.body;

      if (!token || !password) {
        return sendError(
          res,
          ErrorCodes.INVALID_INPUT,
          "Token e nova senha sao obrigatorios",
          400
        );
      }

      // Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return sendError(
          res,
          ErrorCodes.INVALID_INPUT,
          "Senha invalida",
          400,
          { errors: passwordValidation.errors }
        );
      }

      // Find valid token
      const resetToken = await storage.getValidPasswordResetToken(token);
      if (!resetToken) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Token invalido ou expirado", 400);
      }

      // Hash new password (outside transaction to avoid holding DB lock during CPU-intensive operation)
      const passwordHash = await hashPassword(password);

      // Use transaction to ensure atomicity:
      // 1. Invalidate token FIRST (prevents reuse even if password update fails)
      // 2. Then update password
      // If anything fails, both operations roll back
      await db.transaction(async (tx) => {
        // Mark token as used FIRST (invalidate before processing)
        // This prevents token reuse if the password update fails
        // Check rowCount to detect TOCTOU race conditions (another request used the token)
        const tokenResult = await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.token, token));

        if ((tokenResult.rowCount ?? 0) === 0) {
          // Token was already used by another concurrent request
          throw new Error("Token já foi utilizado ou expirou");
        }

        // Update user password
        // Check rowCount to ensure user still exists
        const userResult = await tx
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, resetToken.userId));

        if ((userResult.rowCount ?? 0) === 0) {
          throw new Error("Usuário não encontrado");
        }
      });

      logger.info(`Password reset completed for user: ${resetToken.userId}`);

      return sendSuccess(res, { message: "Senha alterada com sucesso" });
    } catch (error) {
      logger.error("Erro no reset-password:", { error: error instanceof Error ? error.message : String(error) });
      return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro ao redefinir senha", 500);
    }
  });

  // Endpoint: Logout
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return sendError(res, ErrorCodes.INTERNAL_ERROR, "Erro ao encerrar sessao", 500);
      }

      if (!req.session?.destroy) {
        return sendSuccess(res, { message: "Logout realizado com sucesso" });
      }

      req.session.destroy((destroyErr: Error | null) => {
        if (destroyErr) {
          logger.warn("Erro ao destruir sessao", { error: destroyErr.message });
        }
        res.clearCookie("connect.sid");
        return sendSuccess(res, { message: "Logout realizado com sucesso" });
      });
    });
  });

  // Endpoint: Usuario atual
  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return sendError(res, ErrorCodes.UNAUTHORIZED, "Nao autenticado", 401);
    }
    const { passwordHash: _passwordHash, ...safeUser } = req.user as any;
    return sendSuccess(res, safeUser);
  });
}
