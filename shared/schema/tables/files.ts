import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { FileEntityType } from "../enums";
import { organizations } from "./organizations";
import { users } from "./auth";

// Files table for attachments
export const files = pgTable(
  "files",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    size: integer("size"),
    objectPath: varchar("object_path", { length: 1000 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).$type<FileEntityType>().notNull(),
    entityId: integer("entity_id").notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Composite index for file lookups by entity
    index("idx_files_entity").on(table.entityType, table.entityId),
    index("idx_files_organization").on(table.organizationId),
  ],
);

