import { index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import type { ActivityType } from "../enums";
import { contacts } from "./contacts";
import { deals } from "./pipelines";
import { organizations } from "./organizations";
import { users } from "./auth";

// Activities table
export const activities = pgTable(
  "activities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: varchar("type", { length: 20 }).$type<ActivityType>().notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: timestamp("due_date"),
    completedAt: timestamp("completed_at"),
    status: varchar("status", { length: 20 }).default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_activities_org_due_date").on(table.organizationId, table.dueDate),
  ],
);
