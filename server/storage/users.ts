import { users, type User, type UpsertUser } from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  preferences?: { language?: "pt-BR" | "en" };
};

export async function getUser(id: string): Promise<User | undefined> {
  const organizationId = await getTenantOrganizationId();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));
  return user;
}

export async function getUsers(_organizationId: number): Promise<User[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(users)
    .where(eq(users.organizationId, tenantOrganizationId));
}

export async function upsertUser(userData: UpsertUser): Promise<User> {
  const organizationId = await getTenantOrganizationId();
  const [user] = await db
    .insert(users)
    .values({ ...userData, organizationId })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        organizationId,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

export async function updateUserProfile(
  id: string,
  updates: UpdateUserProfileInput,
): Promise<User | undefined> {
  const organizationId = await getTenantOrganizationId();
  // Get existing user to merge preferences
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));
  if (!existing) return undefined;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
  if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
  if (updates.profileImageUrl !== undefined) {
    updateData.profileImageUrl = updates.profileImageUrl;
  }

  // Merge preferences with existing
  if (updates.preferences !== undefined) {
    const existingPrefs = (existing.preferences as Record<string, unknown>) || {};
    updateData.preferences = { ...existingPrefs, ...updates.preferences };
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
    .returning();
  return updated;
}
