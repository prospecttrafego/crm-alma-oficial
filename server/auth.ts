/**
 * Modulo de autenticacao local com Passport.js
 * Substitui a autenticacao Replit por email/senha
 */
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { users, pipelines, pipelineStages } from "@shared/schema";
import { and, count, eq } from "drizzle-orm";
import { getSingleTenantOrganizationId } from "./tenant";

const BCRYPT_ROUNDS = 12;

/**
 * Configura middleware de sessao com PostgreSQL
 */
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 semana
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
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
      maxAge: sessionTtl,
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

  // Endpoint: Login
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Erro interno do servidor" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciais invalidas" });
      }
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

  // Endpoint: Registro (configuravel via env)
  app.post("/api/register", async (req, res) => {
    try {
      const allowRegistration = process.env.ALLOW_REGISTRATION === "true";
      if (!allowRegistration) {
        return res.status(403).json({ message: "Registro desabilitado. Contate o administrador." });
      }

      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha sao obrigatorios" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Senha deve ter no minimo 6 caracteres" });
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
