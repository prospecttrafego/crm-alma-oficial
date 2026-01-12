import { pushTokens, type PushToken, type InsertPushToken } from "@shared/schema";
import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";

export async function getPushTokensForUser(userId: string): Promise<PushToken[]> {
  return await db
    .select()
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId))
    .orderBy(desc(pushTokens.lastUsedAt));
}

export async function createPushToken(token: InsertPushToken): Promise<PushToken> {
  // Check if token already exists for this user
  const existing = await db
    .select()
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, token.userId), eq(pushTokens.token, token.token)))
    .limit(1);

  if (existing.length > 0) {
    // Update lastUsedAt
    const [updated] = await db
      .update(pushTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushTokens.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(pushTokens).values(token).returning();
  return created;
}

export async function deletePushToken(token: string): Promise<void> {
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}

export async function deletePushTokensForUser(userId: string): Promise<void> {
  await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
}

export async function updatePushTokenLastUsed(token: string): Promise<void> {
  await db.update(pushTokens).set({ lastUsedAt: new Date() }).where(eq(pushTokens.token, token));
}
