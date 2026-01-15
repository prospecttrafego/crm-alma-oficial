import {
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  type AuditLogEntityType,
  type AuditLogAction,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq, gte, lte, count } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export interface AuditLogsFilters {
  action?: AuditLogAction;
  entityType?: AuditLogEntityType;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginatedAuditLogsResult {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export async function getAuditLogs(
  _organizationId: number,
  limit: number = 100,
): Promise<AuditLog[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, tenantOrganizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function getAuditLogsPaginated(
  filters: AuditLogsFilters = {},
  page: number = 1,
  limit: number = 50,
): Promise<PaginatedAuditLogsResult> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const offset = (page - 1) * limit;

  // Build conditions array
  const conditions = [eq(auditLogs.organizationId, tenantOrganizationId)];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.entityType) {
    conditions.push(eq(auditLogs.entityType, filters.entityType));
  }
  if (filters.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, filters.dateFrom));
  }
  if (filters.dateTo) {
    // Add 1 day to include the entire "to" day
    const endDate = new Date(filters.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(whereClause);

  const total = countResult?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Get paginated data
  const data = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

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

export async function getAuditLogsByEntity(
  entityType: AuditLogEntityType,
  entityId: number,
): Promise<AuditLog[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId),
        eq(auditLogs.organizationId, tenantOrganizationId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt));
}

export async function createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(auditLogs)
    .values({ ...log, organizationId: tenantOrganizationId })
    .returning();
  return created;
}
