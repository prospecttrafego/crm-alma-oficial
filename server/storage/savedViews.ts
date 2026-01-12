import {
  savedViews,
  type SavedView,
  type InsertSavedView,
  type SavedViewType,
} from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

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

export async function getSavedView(id: number): Promise<SavedView | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [view] = await db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.organizationId, tenantOrganizationId)));
  return view;
}

export async function createSavedView(view: InsertSavedView): Promise<SavedView> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(savedViews)
    .values({ ...view, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

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
