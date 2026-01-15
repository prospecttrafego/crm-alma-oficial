/**
 * Audit Logs API - Query audit logs with filters and pagination
 */

import { api } from "./client";
import { enrichedAuditLogSchema } from "@shared/apiSchemas";
import type { EnrichedAuditLog } from "@shared/types";
import type { AuditLogAction, AuditLogEntityType } from "@shared/schema";
import { z } from "zod";

/**
 * Pagination metadata schema
 */
export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Paginated response schema for audit logs
 */
export const paginatedAuditLogsSchema = z.object({
  data: z.array(enrichedAuditLogSchema),
  pagination: paginationMetaSchema,
});

export type PaginatedAuditLogs = z.infer<typeof paginatedAuditLogsSchema>;

/**
 * Query parameters for audit logs
 */
export interface AuditLogsQueryParams {
  page?: number;
  limit?: number;
  action?: AuditLogAction;
  entityType?: AuditLogEntityType;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const auditLogsApi = {
  /**
   * List paginated audit logs with filters
   */
  list: (params: AuditLogsQueryParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.action) searchParams.set("action", params.action);
    if (params.entityType) searchParams.set("entityType", params.entityType);
    if (params.userId) searchParams.set("userId", params.userId);
    if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
    if (params.dateTo) searchParams.set("dateTo", params.dateTo);

    const queryString = searchParams.toString();
    const url = queryString ? `/api/audit-logs?${queryString}` : "/api/audit-logs";

    return api.get<PaginatedAuditLogs>(url, paginatedAuditLogsSchema);
  },

  /**
   * Get audit logs for a specific entity
   */
  getByEntity: (entityType: AuditLogEntityType, entityId: number) =>
    api.get<EnrichedAuditLog[]>(
      `/api/audit-logs/entity/${entityType}/${entityId}`,
      z.array(enrichedAuditLogSchema)
    ),
};
