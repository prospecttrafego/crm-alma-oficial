import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { UserPreferences, UserRole } from "../enums";
import { organizations } from "./organizations";

// Tabela de armazenamento de sessoes
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Tabela de usuarios (compativel com autenticacao local)
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").unique(),
    passwordHash: varchar("password_hash"),
    firstName: varchar("first_name"),
    lastName: varchar("last_name"),
    profileImageUrl: varchar("profile_image_url"),
    role: varchar("role").$type<UserRole>().default("sales"),
    organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    preferences: jsonb("preferences").$type<UserPreferences>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Composite index for user lookups within organization
    index("idx_users_org_email").on(table.organizationId, table.email),
    // Case-insensitive email index for login lookups
    index("idx_users_email_lower").using("btree", sql`LOWER(${table.email})`),
  ],
);

// Password reset tokens table
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    token: varchar("token", { length: 64 }).primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_password_reset_tokens_user").on(table.userId),
    index("idx_password_reset_tokens_expires").on(table.expiresAt),
  ],
);

