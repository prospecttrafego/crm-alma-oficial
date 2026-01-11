import type { Express } from "express";
import { z } from "zod";
import { auditLogEntityTypes, type AuditLogEntityType } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler, validateParams, validateQuery, getCurrentUser } from "../middleware";
import { sendSuccess, sendForbidden, sendValidationError } from "../response";

// Schemas de validacao
const auditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

const entityAuditLogsParamsSchema = z.object({
  entityType: z.string(),
  entityId: z.coerce.number().int().positive(),
});

export function registerAuditLogRoutes(app: Express) {
  // Get audit logs (admin only)
  app.get(
    "/api/audit-logs",
    isAuthenticated,
    validateQuery(auditLogsQuerySchema),
    asyncHandler(async (req: any, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);

      const currentUser = getCurrentUser(req);
      const user = await storage.getUser(currentUser!.id);
      if (!user || user.role !== "admin") {
        return sendForbidden(res, "Admin access required");
      }

      const { limit } = req.validatedQuery;
      const logs = await storage.getAuditLogs(org.id, limit);

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

  // Get audit logs for specific entity (admin only)
  app.get(
    "/api/audit-logs/entity/:entityType/:entityId",
    isAuthenticated,
    validateParams(entityAuditLogsParamsSchema),
    asyncHandler(async (req: any, res) => {
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
