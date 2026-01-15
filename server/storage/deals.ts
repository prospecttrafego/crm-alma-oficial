/**
 * Deal Storage Module
 * Handles all database operations for sales pipeline deals
 */

import {
  deals,
  pipelines,
  pipelineStages,
  contacts,
  companies,
  type Deal,
  type InsertDeal,
} from "@shared/schema";
import { db } from "../db";
import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import {
  getTenantOrganizationId,
  normalizePagination,
  type PaginationParams,
  type PaginatedResult,
} from "./helpers";

/**
 * Get all deals for an organization
 * @param _organizationId - Organization ID (overridden by tenant in single-tenant mode)
 * @returns Array of deals
 */
export async function getDeals(_organizationId: number): Promise<Deal[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(deals)
    .where(eq(deals.organizationId, tenantOrganizationId));
}

export async function getDealsPaginated(
  _organizationId: number,
  params: PaginationParams & { pipelineId?: number; stageId?: number; status?: string },
): Promise<PaginatedResult<Deal>> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { page, limit, offset } = normalizePagination(params);

  // Build conditions
  const conditions = [eq(deals.organizationId, tenantOrganizationId)];

  if (params.search) {
    conditions.push(ilike(deals.title, `%${params.search}%`));
  }
  if (params.pipelineId) {
    conditions.push(eq(deals.pipelineId, params.pipelineId));
  }
  if (params.stageId) {
    conditions.push(eq(deals.stageId, params.stageId));
  }
  if (params.status) {
    conditions.push(eq(deals.status, params.status as "open" | "won" | "lost"));
  }

  const whereCondition = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(deals)
    .where(whereCondition);
  const total = Number(countResult?.count || 0);

  // Get paginated data
  const sortOrder = params.sortOrder === "asc" ? asc : desc;
  const data = await db
    .select()
    .from(deals)
    .where(whereCondition)
    .orderBy(sortOrder(deals.createdAt))
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

/**
 * Get all deals in a specific pipeline
 * @param pipelineId - Pipeline ID to filter by
 * @returns Array of deals in the pipeline
 */
export async function getDealsByPipeline(pipelineId: number): Promise<Deal[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(deals)
    .where(and(eq(deals.pipelineId, pipelineId), eq(deals.organizationId, tenantOrganizationId)));
}

/**
 * Get a single deal by ID
 * @param id - Deal ID
 * @returns Deal or undefined if not found
 */
export async function getDeal(id: number): Promise<Deal | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [deal] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.organizationId, tenantOrganizationId)));
  return deal;
}

/**
 * Create a new deal
 * Validates that pipeline, stage, contact, and company exist before creation
 * @param deal - Deal data to insert
 * @returns Created deal
 * @throws Error if pipeline, stage, contact, or company not found
 */
export async function createDeal(deal: InsertDeal): Promise<Deal> {
  const tenantOrganizationId = await getTenantOrganizationId();

  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, deal.pipelineId), eq(pipelines.organizationId, tenantOrganizationId)))
    .limit(1);
  if (!pipeline) {
    throw new Error("Pipeline not found");
  }

  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.id, deal.stageId), eq(pipelineStages.pipelineId, deal.pipelineId)))
    .limit(1);
  if (!stage) {
    throw new Error("Pipeline stage not found");
  }

  if (deal.contactId) {
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, deal.contactId), eq(contacts.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!contact) throw new Error("Contact not found");
  }

  if (deal.companyId) {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, deal.companyId), eq(companies.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!company) throw new Error("Company not found");
  }

  const [created] = await db
    .insert(deals)
    .values({ ...deal, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

/**
 * Update an existing deal
 * @param id - Deal ID to update
 * @param deal - Partial deal data to update
 * @returns Updated deal or undefined if not found
 */
export async function updateDeal(
  id: number,
  deal: Partial<InsertDeal>,
): Promise<Deal | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = deal as Partial<
    InsertDeal & { organizationId?: number }
  >;
  const [updated] = await db
    .update(deals)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(deals.id, id), eq(deals.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

/**
 * Delete a deal
 * @param id - Deal ID to delete
 */
export async function deleteDeal(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(deals)
    .where(and(eq(deals.id, id), eq(deals.organizationId, tenantOrganizationId)));
}

/**
 * Options for moving a deal to a new stage
 */
interface MoveDealOptions {
  status?: "open" | "won" | "lost";
  lostReason?: string;
}

/**
 * Move a deal to a different stage in its pipeline
 * Automatically updates deal status to 'won' or 'lost' if target stage is marked as such
 * @param dealId - Deal ID to move
 * @param stageId - Target stage ID (must be in same pipeline)
 * @param options - Optional status and lostReason overrides
 * @returns Updated deal or undefined if deal/stage not found or stage not in same pipeline
 */
export async function moveDealToStage(
  dealId: number,
  stageId: number,
  options?: MoveDealOptions,
): Promise<Deal | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();

  const [deal] = await db
    .select({ pipelineId: deals.pipelineId })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, tenantOrganizationId)))
    .limit(1);
  if (!deal) return undefined;

  const [stage] = await db
    .select({
      pipelineId: pipelineStages.pipelineId,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost,
    })
    .from(pipelineStages)
    .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
    .where(and(eq(pipelineStages.id, stageId), eq(pipelines.organizationId, tenantOrganizationId)))
    .limit(1);
  if (!stage) return undefined;

  if (stage.pipelineId !== deal.pipelineId) return undefined;

  // Use provided status or infer from stage flags
  let status: string = options?.status || "open";
  if (!options?.status) {
    if (stage.isWon) status = "won";
    if (stage.isLost) status = "lost";
  }

  const updateData: Record<string, unknown> = { stageId, status, updatedAt: new Date() };
  if (options?.lostReason !== undefined) {
    updateData.lostReason = options.lostReason;
  }

  const [updated] = await db
    .update(deals)
    .set(updateData)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function getDealsByContact(contactId: number): Promise<Deal[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(deals)
    .where(and(eq(deals.contactId, contactId), eq(deals.organizationId, tenantOrganizationId)));
}

/**
 * Unlink deals from a contact (preserve deal history but remove contact reference)
 */
export async function unlinkDealsFromContact(contactId: number): Promise<number> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const result = await db
    .update(deals)
    .set({ contactId: null, updatedAt: new Date() })
    .where(and(eq(deals.contactId, contactId), eq(deals.organizationId, tenantOrganizationId)))
    .returning({ id: deals.id });
  return result.length;
}
