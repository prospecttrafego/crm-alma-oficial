import type { Express } from "express";
import { z } from "zod";
import { auditLogEntityTypes, auditLogActions, type AuditLogEntityType, type AuditLogAction } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler, validateParams, validateQuery, getCurrentUser } from "../middleware";
import { sendSuccess, sendForbidden, sendValidationError } from "../response";
import type { AuditLogsFilters } from "../storage/auditLogs";

// Schemas de validacao
const auditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().default(50),
  page: z.coerce.number().int().positive().optional().default(1),
  action: z.enum(auditLogActions).optional(),
  entityType: z.enum(auditLogEntityTypes).optional(),
  userId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const entityAuditLogsParamsSchema = z.object({
  entityType: z.string(),
  entityId: z.coerce.number().int().positive(),
});

export function registerAuditLogRoutes(app: Express) {
  // Get audit logs (admin only) - with pagination and filters
  app.get(
    "/api/audit-logs",
    isAuthenticated,
    validateQuery(auditLogsQuerySchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false } });

      const currentUser = getCurrentUser(req);
      const user = await storage.getUser(currentUser!.id);
      if (!user || user.role !== "admin") {
        return sendForbidden(res, "Admin access required");
      }

      const { limit, page, action, entityType, userId, dateFrom, dateTo } = req.validatedQuery;

      // Build filters
      const filters: AuditLogsFilters = {};
      if (action) filters.action = action as AuditLogAction;
      if (entityType) filters.entityType = entityType as AuditLogEntityType;
      if (userId) filters.userId = userId;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);

      const result = await storage.getAuditLogsPaginated(filters, page, limit);

      // Enrich logs with user info
      const enrichedLogs = await Promise.all(
        result.data.map(async (log) => {
          const logUser = await storage.getUser(log.userId);
          return {
            ...log,
            user: logUser ? { id: logUser.id, firstName: logUser.firstName, lastName: logUser.lastName } : null,
          };
        })
      );

      sendSuccess(res, {
        data: enrichedLogs,
        pagination: result.pagination,
      });
    })
  );

  // Get audit logs for specific entity (admin only)
  app.get(
    "/api/audit-logs/entity/:entityType/:entityId",
    isAuthenticated,
    validateParams(entityAuditLogsParamsSchema),
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const user = await storage.getUser(currentUser!.id);
      if (!user || user.role !== "admin") {
        return sendForbidden(res, "Admin access required");
      }

      const { entityType, entityId } = req.validatedParams;

      if (!auditLogEntityTypes.includes(entityType as AuditLogEntityType)) {
        return sendValidationError(res, "Invalid entity type");
      }

      const logs = await storage.getAuditLogsByEntity(entityType as AuditLogEntityType, entityId);

      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const logUser = await storage.getUser(log.userId);
          return {
            ...log,
            user: logUser ? { id: logUser.id, firstName: logUser.firstName, lastName: logUser.lastName } : null,
          };
        })
      );

      sendSuccess(res, enrichedLogs);
    })
  );
}
