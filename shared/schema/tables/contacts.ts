import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { organizations } from "./organizations";
import { users } from "./auth";

// Contacts table
export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    phoneNormalized: varchar("phone_normalized", { length: 50 }), // Apenas digitos para busca rapida
    jobTitle: varchar("job_title", { length: 100 }),
    companyId: integer("company_id").references(() => companies.id, { onDelete: "set null" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
    tags: text("tags").array(),
    source: varchar("source", { length: 100 }),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_contacts_organization").on(table.organizationId),
    index("idx_contacts_email").on(table.email),
    // Case-insensitive email index for contact lookups
    index("idx_contacts_email_lower").using("btree", sql`LOWER(${table.email})`),
    index("idx_contacts_phone").on(table.phone),
    index("idx_contacts_phone_normalized").on(table.phoneNormalized),
    index("idx_contacts_company").on(table.companyId),
  ],
);

