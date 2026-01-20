import { boolean, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import type { ChannelConfigType, WhatsAppConfig } from "../enums";
import { organizations } from "./organizations";
import { users } from "./auth";

// Channel configurations table for IMAP/SMTP and WhatsApp settings
export const channelConfigs = pgTable(
  "channel_configs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).$type<ChannelConfigType>().notNull(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true),
    emailConfig: jsonb("email_config").$type<{
      imapHost: string;
      imapPort: number;
      imapSecure: boolean;
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      email: string;
      password: string;
      fromName?: string;
      lastSyncUid?: number;
    }>(),
    whatsappConfig: jsonb("whatsapp_config").$type<WhatsAppConfig>(),
    lastSyncAt: timestamp("last_sync_at"),
    createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_channel_configs_org_type_active").on(table.organizationId, table.type, table.isActive),
  ],
);
