import { asc, count, eq } from "drizzle-orm";
import { organizations } from "@shared/schema";
import { db } from "./db";

/**
 * Promise-based cache to prevent race conditions.
 * When multiple requests call getSingleTenantOrganizationId() simultaneously,
 * only ONE database query runs - all others await the same Promise.
 */
let organizationIdPromise: Promise<number> | null = null;

function parseOrganizationId(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Internal function that performs the actual database lookup.
 * This is only called once and cached via Promise.
 */
async function fetchOrganizationId(): Promise<number> {
  const envOrgId = parseOrganizationId(process.env.DEFAULT_ORGANIZATION_ID);
  if (envOrgId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, envOrgId))
      .limit(1);

    if (!org) {
      throw new Error(
        `DEFAULT_ORGANIZATION_ID=${envOrgId} was not found in the database.`,
      );
    }

    return envOrgId;
  }

  const [orgCountRow] = await db
    .select({ count: count() })
    .from(organizations)
    .limit(1);
  const orgCount = Number(orgCountRow?.count || 0);

  if (orgCount !== 1) {
    throw new Error(
      `Single-tenant mode requires exactly 1 organization when DEFAULT_ORGANIZATION_ID is not set (found ${orgCount}).`,
    );
  }

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .orderBy(asc(organizations.id))
    .limit(1);

  if (!org) {
    throw new Error(
      "No organizations found. Create one and set DEFAULT_ORGANIZATION_ID.",
    );
  }

  return org.id;
}

/**
 * Single-tenant organization ID.
 *
 * - If `DEFAULT_ORGANIZATION_ID` is set, it must exist in DB.
 * - If not set, it will be auto-derived only when exactly one organization exists.
 *
 * Uses Promise-based caching to prevent race conditions - all concurrent calls
 * will await the same Promise instead of making multiple database queries.
 */
export async function getSingleTenantOrganizationId(): Promise<number> {
  // If no Promise exists yet, create one that resolves to the organization ID.
  // All concurrent calls will share this same Promise.
  if (!organizationIdPromise) {
    organizationIdPromise = fetchOrganizationId();
  }

  return organizationIdPromise;
}

/**
 * Clear the cached organization ID.
 * Useful for testing or when organization changes.
 */
export function clearOrganizationCache(): void {
  organizationIdPromise = null;
}

