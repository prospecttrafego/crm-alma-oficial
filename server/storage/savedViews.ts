import {
  savedViews,
  type SavedView,
  type InsertSavedView,
  type SavedViewType,
} from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

/**
 * Lists saved views of a given `type` for the specified user within the current tenant.
 */
export async function getSavedViews(
  userId: string,
  type: SavedViewType,
): Promise<SavedView[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(savedViews)
    .where(
      and(
        eq(savedViews.userId, userId),
        eq(savedViews.type, type),
        eq(savedViews.organizationId, tenantOrganizationId),
      ),
    )
    .orderBy(savedViews.name);
}

/**
 * Returns a saved view by ID within the current tenant.
 */
export async function getSavedView(id: number): Promise<SavedView | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [view] = await db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.organizationId, tenantOrganizationId)));
  return view;
}

/**
 * Creates a saved view in the current tenant (organizationId is injected server-side).
 */
export async function createSavedView(view: InsertSavedView): Promise<SavedView> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(savedViews)
    .values({ ...view, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

/**
 * Updates a saved view owned by the given user, scoped to the current tenant.
 *
 * `organizationId` is ignored even if provided by the caller.
 */
export async function updateSavedView(
  id: number,
  userId: string,
  view: Partial<InsertSavedView>,
): Promise<SavedView | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = view as Partial<
    InsertSavedView & { organizationId?: number }
  >;
  const [updated] = await db
    .update(savedViews)
    .set({ ...updateData, updatedAt: new Date() })
    .where(
      and(
        eq(savedViews.id, id),
        eq(savedViews.userId, userId),
        eq(savedViews.organizationId, tenantOrganizationId),
      ),
    )
    .returning();
  return updated;
}

/**
 * Deletes a saved view owned by the given user, scoped to the current tenant.
 */
export async function deleteSavedView(id: number, userId: string): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(savedViews)
    .where(
      and(
        eq(savedViews.id, id),
        eq(savedViews.userId, userId),
        eq(savedViews.organizationId, tenantOrganizationId),
      ),
    );
}
