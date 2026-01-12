import { activities, type Activity, type InsertActivity } from "@shared/schema";
import { db } from "../db";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import {
  getTenantOrganizationId,
  normalizePagination,
  type PaginationParams,
  type PaginatedResult,
} from "./helpers";

export async function getActivities(_organizationId: number): Promise<Activity[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(activities)
    .where(eq(activities.organizationId, tenantOrganizationId))
    .orderBy(desc(activities.createdAt));
}

export async function getActivitiesPaginated(
  _organizationId: number,
  params: PaginationParams & { type?: string; status?: string; userId?: string },
): Promise<PaginatedResult<Activity>> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { page, limit, offset } = normalizePagination(params);

  // Build conditions
  const conditions = [eq(activities.organizationId, tenantOrganizationId)];

  if (params.search) {
    conditions.push(ilike(activities.title, `%${params.search}%`));
  }
  if (params.type) {
    conditions.push(eq(activities.type, params.type as "call" | "email" | "meeting" | "note" | "task"));
  }
  if (params.status) {
    conditions.push(eq(activities.status, params.status as "pending" | "completed" | "cancelled"));
  }
  if (params.userId) {
    conditions.push(eq(activities.userId, params.userId));
  }

  const whereCondition = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(activities)
    .where(whereCondition);
  const total = Number(countResult?.count || 0);

  // Get paginated data
  const data = await db
    .select()
    .from(activities)
    .where(whereCondition)
    .orderBy(desc(activities.createdAt))
    .limit(limit)
    .offset(offset);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export async function getActivity(id: number): Promise<Activity | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.organizationId, tenantOrganizationId)));
  return activity;
}

export async function createActivity(activity: InsertActivity): Promise<Activity> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(activities)
    .values({ ...activity, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateActivity(
  id: number,
  activity: Partial<InsertActivity>,
): Promise<Activity | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = activity as Partial<
    InsertActivity & { organizationId?: number }
  >;
  const [updated] = await db
    .update(activities)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(activities.id, id), eq(activities.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteActivity(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.organizationId, tenantOrganizationId)));
}

/**
 * Get all activities for a contact
 */
export async function getActivitiesByContact(contactId: number): Promise<Activity[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(activities)
    .where(and(eq(activities.contactId, contactId), eq(activities.organizationId, tenantOrganizationId)));
}

/**
 * Delete all activities for a contact
 */
export async function deleteActivitiesByContact(contactId: number): Promise<number> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const result = await db
    .delete(activities)
    .where(and(eq(activities.contactId, contactId), eq(activities.organizationId, tenantOrganizationId)))
    .returning({ id: activities.id });
  return result.length;
}
