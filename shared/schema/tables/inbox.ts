import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { ChannelType, MessageContentType } from "../enums";
import { deals } from "./pipelines";
import { contacts } from "./contacts";
import { organizations } from "./organizations";
import { users } from "./auth";

// Conversations table
export const conversations = pgTable(
  "conversations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    subject: varchar("subject", { length: 500 }),
    channel: varchar("channel", { length: 20 }).$type<ChannelType>().notNull(),
    status: varchar("status", { length: 20 }).default("open"),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at"),
    unreadCount: integer("unread_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_conversations_organization").on(table.organizationId),
    index("idx_conversations_contact").on(table.contactId),
    index("idx_conversations_status").on(table.status),
    index("idx_conversations_last_message").on(table.lastMessageAt),
    // Composite indexes for common query patterns
    index("idx_conversations_org_status").on(table.organizationId, table.status),
    index("idx_conversations_contact_channel").on(table.contactId, table.channel),
  ],
);

// Messages table
export const messages = pgTable(
  "messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderType: varchar("sender_type", { length: 20 }),
    content: text("content").notNull(),
    contentType: varchar("content_type", { length: 20 }).$type<MessageContentType>().default("text"),
    isInternal: boolean("is_internal").default(false),
    attachments: jsonb("attachments").$type<Array<{ name: string; url: string; type: string }>>(),
    metadata: jsonb("metadata").$type<{ transcription?: string; duration?: number; waveform?: number[] }>(),
    mentions: text("mentions").array(),
    readBy: text("read_by").array(),
    // External ID for idempotency (e.g., WhatsApp message ID)
    externalId: varchar("external_id", { length: 255 }),
    // Reply/Quote: references the message being replied to
    replyToId: integer("reply_to_id"),
    // Edit/Delete fields
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    originalContent: text("original_content"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Self-referencing FK: reply_to_id -> messages.id (nullable, ON DELETE SET NULL)
    foreignKey({
      columns: [table.replyToId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    index("idx_messages_conversation").on(table.conversationId),
    index("idx_messages_created_at").on(table.createdAt),
    index("idx_messages_external_id").on(table.externalId),
    uniqueIndex("idx_messages_external_id_unique")
      .on(table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    // Composite index for pagination queries
    index("idx_messages_conv_created").on(table.conversationId, table.createdAt),
    // Index for reply lookups
    index("idx_messages_reply_to").on(table.replyToId),
    // Index for soft-delete filtering
    index("idx_messages_deleted_at").on(table.deletedAt),
    // Full-text search index (expression-based, no generated column required)
    index("idx_messages_content_search").using(
      "gin",
      sql`to_tsvector('portuguese', coalesce(${table.content}, ''))`,
    ),
  ],
);
