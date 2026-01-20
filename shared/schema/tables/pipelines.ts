import { sql } from "drizzle-orm";
import { boolean, check, decimal, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { contacts } from "./contacts";
import { organizations } from "./organizations";
import { users } from "./auth";

// Pipelines table
export const pipelines = pgTable("pipelines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pipeline stages table
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    pipelineId: integer("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    color: varchar("color", { length: 7 }),
    isWon: boolean("is_won").default(false),
    isLost: boolean("is_lost").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Ensure order is non-negative
    check("chk_stage_order_positive", sql`${table.order} >= 0`),
  ],
);

// Deals table
export const deals = pgTable(
  "deals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: varchar("title", { length: 255 }).notNull(),
    value: decimal("value", { precision: 15, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("BRL"),
    pipelineId: integer("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    stageId: integer("stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
    probability: integer("probability").default(0),
    expectedCloseDate: timestamp("expected_close_date"),
    status: varchar("status", { length: 20 }).default("open"),
    lostReason: varchar("lost_reason", { length: 255 }),
    source: varchar("source", { length: 100 }),
    notes: text("notes"),
    tags: text("tags").array(),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_deals_organization").on(table.organizationId),
    index("idx_deals_pipeline").on(table.pipelineId),
    index("idx_deals_stage").on(table.stageId),
    index("idx_deals_status").on(table.status),
    // Ensure probability is between 0 and 100
    check("chk_deal_probability_range", sql`${table.probability} >= 0 AND ${table.probability} <= 100`),
    // Ensure value is non-negative
    check("chk_deal_value_positive", sql`${table.value} IS NULL OR ${table.value} >= 0`),
  ],
);

