import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { AuditLogAction, AuditLogEntityType } from "../enums";
import { organizations } from "./organizations";
import { users } from "./auth";

// Audit logs table
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 20 }).$type<AuditLogAction>().notNull(),
    entityType: varchar("entity_type", { length: 50 }).$type<AuditLogEntityType>().notNull(),
    entityId: integer("entity_id").notNull(),
    entityName: varchar("entity_name", { length: 255 }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_org_created_at").on(table.organizationId, table.createdAt),
    index("idx_audit_logs_org_entity").on(table.organizationId, table.entityType, table.entityId),
    index("idx_audit_logs_org_user").on(table.organizationId, table.userId),
    index("idx_audit_logs_org_action").on(table.organizationId, table.action),
  ],
);
