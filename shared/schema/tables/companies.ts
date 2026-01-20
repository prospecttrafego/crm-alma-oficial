import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./auth";

// Companies table
export const companies = pgTable(
  "companies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    website: varchar("website", { length: 500 }),
    segment: varchar("segment", { length: 100 }),
    size: varchar("size", { length: 50 }),
    industry: varchar("industry", { length: 100 }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_companies_organization").on(table.organizationId),
    index("idx_companies_domain").on(table.domain),
  ],
);

