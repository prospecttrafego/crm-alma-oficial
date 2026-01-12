import { organizations, type Organization, type InsertOrganization } from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getOrganization(id: number): Promise<Organization | undefined> {
  const organizationId = await getTenantOrganizationId();
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), eq(organizations.id, organizationId)));
  return org;
}

export async function createOrganization(
  org: InsertOrganization,
): Promise<Organization> {
  const [created] = await db.insert(organizations).values(org).returning();
  return created;
}

export async function getDefaultOrganization(): Promise<Organization | undefined> {
  const organizationId = await getTenantOrganizationId();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org;
}
