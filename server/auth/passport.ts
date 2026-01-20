import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { getSingleTenantOrganizationId } from "../tenant";
import { verifyPassword } from "./password-policy";

/**
 * Configura autenticacao com Passport Local Strategy
 */
export function configurePassport() {
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

          const isValid = await verifyPassword(password, user.passwordHash);
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
}
