import { companies, type Company, type InsertCompany } from "@shared/schema";
import { db } from "../db";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  getTenantOrganizationId,
  normalizePagination,
  type PaginationParams,
  type PaginatedResult,
} from "./helpers";

export async function getCompanies(_organizationId: number): Promise<Company[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(companies)
    .where(eq(companies.organizationId, tenantOrganizationId));
}

export async function getCompaniesPaginated(
  _organizationId: number,
  params: PaginationParams,
): Promise<PaginatedResult<Company>> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { page, limit, offset } = normalizePagination(params);

  // Build search condition
  const searchCondition = params.search
    ? or(
        ilike(companies.name, `%${params.search}%`),
        ilike(companies.domain, `%${params.search}%`),
        ilike(companies.industry, `%${params.search}%`),
      )
    : undefined;

  const whereCondition = searchCondition
    ? and(eq(companies.organizationId, tenantOrganizationId), searchCondition)
    : eq(companies.organizationId, tenantOrganizationId);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(companies)
    .where(whereCondition);
  const total = Number(countResult?.count || 0);

  // Get paginated data
  const sortOrder = params.sortOrder === "asc" ? asc : desc;
  const data = await db
    .select()
    .from(companies)
    .where(whereCondition)
    .orderBy(sortOrder(companies.createdAt))
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

export async function getCompany(id: number): Promise<Company | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.organizationId, tenantOrganizationId)));
  return company;
}

export async function getCompanyByName(
  name: string,
  _organizationId: number,
): Promise<Company | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        sql`LOWER(${companies.name}) = LOWER(${name})`,
        eq(companies.organizationId, tenantOrganizationId),
      ),
    );
  return company;
}

export async function createCompany(company: InsertCompany): Promise<Company> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(companies)
    .values({ ...company, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateCompany(
  id: number,
  company: Partial<InsertCompany>,
): Promise<Company | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = company as Partial<
    InsertCompany & { organizationId?: number }
  >;
  const [updated] = await db
    .update(companies)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(companies.id, id), eq(companies.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteCompany(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(companies)
    .where(and(eq(companies.id, id), eq(companies.organizationId, tenantOrganizationId)));
}
