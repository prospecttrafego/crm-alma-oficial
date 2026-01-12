import {
  passwordResetTokens,
  type PasswordResetToken,
  type InsertPasswordResetToken,
} from "@shared/schema";
import { db } from "../db";
import { and, eq, gte, lt, sql } from "drizzle-orm";

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(
  token: InsertPasswordResetToken,
): Promise<PasswordResetToken> {
  // Delete any existing tokens for this user first
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, token.userId));

  const [created] = await db.insert(passwordResetTokens).values(token).returning();
  return created;
}

/**
 * Get a valid (not expired, not used) password reset token
 */
export async function getValidPasswordResetToken(
  token: string,
): Promise<PasswordResetToken | undefined> {
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gte(passwordResetTokens.expiresAt, new Date()),
        sql`${passwordResetTokens.usedAt} IS NULL`,
      ),
    )
    .limit(1);
  return resetToken;
}

/**
 * Mark a password reset token as used
 */
export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
}

/**
 * Delete expired password reset tokens (cleanup)
 */
export async function cleanupExpiredPasswordResetTokens(): Promise<number> {
  const result = await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, new Date()))
    .returning({ token: passwordResetTokens.token });
  return result.length;
}
