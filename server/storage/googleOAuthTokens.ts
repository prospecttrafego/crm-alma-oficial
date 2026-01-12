import {
  googleOAuthTokens,
  type GoogleOAuthToken,
  type InsertGoogleOAuthToken,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export async function getGoogleOAuthToken(
  userId: string,
): Promise<GoogleOAuthToken | undefined> {
  const [token] = await db
    .select()
    .from(googleOAuthTokens)
    .where(eq(googleOAuthTokens.userId, userId));
  return token;
}

export async function createGoogleOAuthToken(
  token: InsertGoogleOAuthToken,
): Promise<GoogleOAuthToken> {
  // Delete existing token for this user first (one token per user)
  await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, token.userId));

  const [created] = await db.insert(googleOAuthTokens).values(token).returning();
  return created;
}

export async function updateGoogleOAuthToken(
  userId: string,
  updates: Partial<InsertGoogleOAuthToken>,
): Promise<GoogleOAuthToken | undefined> {
  const [updated] = await db
    .update(googleOAuthTokens)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(googleOAuthTokens.userId, userId))
    .returning();
  return updated;
}

export async function deleteGoogleOAuthToken(userId: string): Promise<void> {
  await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId));
}
