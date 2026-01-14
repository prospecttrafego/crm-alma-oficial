import {
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  type AuditLogEntityType,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

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
