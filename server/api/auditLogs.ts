import type { Express } from "express";
import { auditLogEntityTypes, type AuditLogEntityType } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

export function registerAuditLogRoutes(app: Express) {
  // Audit Logs endpoints
  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const user = await storage.getUser((req.user as any).id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(org.id, limit);

      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const logUser = await storage.getUser(log.userId);
          return {
            ...log,
            user: logUser ? { id: logUser.id, firstName: logUser.firstName, lastName: logUser.lastName } : null,
          };
        }),
      );
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/entity/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      // Audit logs require admin access
      const user = await storage.getUser((req.user as any).id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const entityType = req.params.entityType as AuditLogEntityType;
      const entityId = parseInt(req.params.entityId);
      if (!auditLogEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      if (isNaN(entityId)) return res.status(400).json({ message: "Invalid entity ID" });

      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      const enrichedLogs = await Promise.all(
        logs.map(async (log) => {
          const logUser = await storage.getUser(log.userId);
          return {
            ...log,
            user: logUser ? { id: logUser.id, firstName: logUser.firstName, lastName: logUser.lastName } : null,
          };
        }),
      );
      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching entity audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });
}

