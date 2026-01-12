import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  decimal,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

const { createInsertSchema, createUpdateSchema } = createSchemaFactory({
  coerce: {
    date: true,
  },
});

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

// User roles enum
export const userRoles = ["admin", "sales", "cs", "support"] as const;
export type UserRole = (typeof userRoles)[number];

// User preferences type
export type UserPreferences = {
  language?: 'pt-BR' | 'en';
};

// Tabela de usuarios (compativel com autenticacao local)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").$type<UserRole>().default("sales"),
  organizationId: integer("organization_id"),
  preferences: jsonb("preferences").$type<UserPreferences>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens table
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    token: varchar("token", { length: 64 }).primaryKey(),
    userId: varchar("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_password_reset_tokens_user").on(table.userId),
    index("idx_password_reset_tokens_expires").on(table.expiresAt),
  ]
);

// Organizations table
export const organizations = pgTable("organizations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  logo: varchar("logo"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
    organizationId: integer("organization_id").notNull(),
    ownerId: varchar("owner_id"),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_companies_organization").on(table.organizationId),
    index("idx_companies_domain").on(table.domain),
  ]
);

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
    companyId: integer("company_id"),
    organizationId: integer("organization_id").notNull(),
    ownerId: varchar("owner_id"),
    tags: text("tags").array(),
    source: varchar("source", { length: 100 }),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_contacts_organization").on(table.organizationId),
    index("idx_contacts_email").on(table.email),
    index("idx_contacts_phone").on(table.phone),
    index("idx_contacts_phone_normalized").on(table.phoneNormalized),
    index("idx_contacts_company").on(table.companyId),
  ]
);

// Pipelines table
export const pipelines = pgTable("pipelines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  organizationId: integer("organization_id").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pipeline stages table
export const pipelineStages = pgTable("pipeline_stages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull(),
  pipelineId: integer("pipeline_id").notNull(),
  order: integer("order").notNull(),
  color: varchar("color", { length: 7 }),
  isWon: boolean("is_won").default(false),
  isLost: boolean("is_lost").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Deals table
export const deals = pgTable(
  "deals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: varchar("title", { length: 255 }).notNull(),
    value: decimal("value", { precision: 15, scale: 2 }),
    currency: varchar("currency", { length: 3 }).default("BRL"),
    pipelineId: integer("pipeline_id").notNull(),
    stageId: integer("stage_id").notNull(),
    contactId: integer("contact_id"),
    companyId: integer("company_id"),
    organizationId: integer("organization_id").notNull(),
    ownerId: varchar("owner_id"),
    probability: integer("probability").default(0),
    expectedCloseDate: timestamp("expected_close_date"),
    status: varchar("status", { length: 20 }).default("open"),
    lostReason: varchar("lost_reason", { length: 255 }),
    source: varchar("source", { length: 100 }),
    notes: text("notes"),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_deals_organization").on(table.organizationId),
    index("idx_deals_pipeline").on(table.pipelineId),
    index("idx_deals_stage").on(table.stageId),
    index("idx_deals_status").on(table.status),
  ]
);

// Channel types for conversations
export const channelTypes = ["email", "whatsapp", "sms", "internal", "phone"] as const;
export type ChannelType = (typeof channelTypes)[number];

// Conversation statuses
export const conversationStatuses = ["open", "closed", "pending"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

// Conversations table
export const conversations = pgTable(
  "conversations",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    subject: varchar("subject", { length: 500 }),
    channel: varchar("channel", { length: 20 }).$type<ChannelType>().notNull(),
    status: varchar("status", { length: 20 }).default("open"),
    contactId: integer("contact_id"),
    dealId: integer("deal_id"),
    organizationId: integer("organization_id").notNull(),
    assignedToId: varchar("assigned_to_id"),
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
  ]
);

// Message content types
export const messageContentTypes = ["text", "audio", "image", "file", "video"] as const;
export type MessageContentType = (typeof messageContentTypes)[number];

// Messages table
export const messages = pgTable(
  "messages",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    conversationId: integer("conversation_id").notNull(),
    senderId: varchar("sender_id"),
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
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_messages_conversation").on(table.conversationId),
    index("idx_messages_created_at").on(table.createdAt),
    index("idx_messages_external_id").on(table.externalId),
  ]
);

// Activity types
export const activityTypes = ["call", "email", "meeting", "note", "task"] as const;
export type ActivityType = (typeof activityTypes)[number];

// Activity statuses
export const activityStatuses = ["pending", "completed", "cancelled"] as const;
export type ActivityStatus = (typeof activityStatuses)[number];

// Saved view types
export const savedViewTypes = ["pipeline", "inbox", "contacts", "companies", "deals", "activities"] as const;
export type SavedViewType = (typeof savedViewTypes)[number];

// Saved views table
export const savedViews = pgTable("saved_views", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).$type<SavedViewType>().notNull(),
  userId: varchar("user_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification types
export const notificationTypes = [
  "new_message",
  "deal_moved",
  "deal_won",
  "deal_lost",
  "task_due",
  "mention",
  "activity_assigned",
  "conversation_assigned",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

// Email templates table
export const emailTemplates = pgTable("email_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  variables: text("variables").array(),
  organizationId: integer("organization_id").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  type: varchar("type", { length: 50 }).$type<NotificationType>().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: integer("entity_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Push tokens table for FCM
export const pushTokens = pgTable("push_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull(),
  deviceInfo: text("device_info"),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activities table
export const activities = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: varchar("type", { length: 20 }).$type<ActivityType>().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  contactId: integer("contact_id"),
  dealId: integer("deal_id"),
  organizationId: integer("organization_id").notNull(),
  userId: varchar("user_id"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit log action types
export const auditLogActions = ["create", "update", "delete", "lgpd_export", "lgpd_delete"] as const;
export type AuditLogAction = (typeof auditLogActions)[number];

// Audit log entity types
export const auditLogEntityTypes = ["deal", "contact", "company", "conversation", "activity", "pipeline", "email_template", "file", "integration"] as const;
export type AuditLogEntityType = (typeof auditLogEntityTypes)[number];

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  action: varchar("action", { length: 20 }).$type<AuditLogAction>().notNull(),
  entityType: varchar("entity_type", { length: 50 }).$type<AuditLogEntityType>().notNull(),
  entityId: integer("entity_id").notNull(),
  entityName: varchar("entity_name", { length: 255 }),
  organizationId: integer("organization_id").notNull(),
  changes: jsonb("changes").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// File entity types for attachments
export const fileEntityTypes = ["message", "activity", "deal", "contact"] as const;
export type FileEntityType = (typeof fileEntityTypes)[number];

// Lead score entity types
export const leadScoreEntityTypes = ["contact", "deal"] as const;
export type LeadScoreEntityType = (typeof leadScoreEntityTypes)[number];

// Calendar event types
export const calendarEventTypes = ["meeting", "call", "task", "reminder", "other"] as const;
export type CalendarEventType = (typeof calendarEventTypes)[number];

// Channel configuration types
export const channelConfigTypes = ["email", "whatsapp"] as const;
export type ChannelConfigType = (typeof channelConfigTypes)[number];

// WhatsApp connection status for Evolution API
export const whatsappConnectionStatuses = ["disconnected", "connecting", "connected", "qr_pending"] as const;
export type WhatsAppConnectionStatus = (typeof whatsappConnectionStatuses)[number];

// WhatsApp configuration type (Evolution API + legacy Meta Cloud API)
export type WhatsAppConfig = {
  // Evolution API fields
  instanceName?: string;
  connectionStatus?: WhatsAppConnectionStatus;
  qrCode?: string;
  phoneNumber?: string;
  lastConnectedAt?: string;
  // Legacy Meta Cloud API fields (backward compatibility)
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
};

// Channel configurations table for IMAP/SMTP and WhatsApp settings
export const channelConfigs = pgTable("channel_configs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).$type<ChannelConfigType>().notNull(),
  organizationId: integer("organization_id").notNull(),
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
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Calendar sync source types
export const calendarSyncSources = ["local", "google"] as const;
export type CalendarSyncSource = (typeof calendarSyncSources)[number];

// Calendar events table
export const calendarEvents = pgTable("calendar_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).$type<CalendarEventType>().default("meeting"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  allDay: boolean("all_day").default(false),
  location: varchar("location", { length: 500 }),
  contactId: integer("contact_id"),
  dealId: integer("deal_id"),
  activityId: integer("activity_id"),
  organizationId: integer("organization_id").notNull(),
  userId: varchar("user_id"),
  attendees: text("attendees").array(),
  color: varchar("color", { length: 7 }),
  // Google Calendar sync fields
  googleEventId: varchar("google_event_id", { length: 255 }),
  googleCalendarId: varchar("google_calendar_id", { length: 255 }),
  syncSource: varchar("sync_source", { length: 20 }).$type<CalendarSyncSource>().default("local"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google Calendar sync status
export const googleCalendarSyncStatuses = ["idle", "syncing", "error"] as const;
export type GoogleCalendarSyncStatus = (typeof googleCalendarSyncStatuses)[number];

// Google OAuth tokens table (per-user)
export const googleOAuthTokens = pgTable("google_oauth_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: varchar("token_type", { length: 50 }),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  email: varchar("email", { length: 255 }),
  calendarId: varchar("calendar_id", { length: 255 }),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: varchar("sync_status", { length: 20 }).$type<GoogleCalendarSyncStatus>().default("idle"),
  syncError: text("sync_error"),
  syncToken: text("sync_token"), // For Google Calendar incremental sync
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead scores table for AI scoring history
export const leadScores = pgTable("lead_scores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  entityType: varchar("entity_type", { length: 20 }).$type<LeadScoreEntityType>().notNull(),
  entityId: integer("entity_id").notNull(),
  score: integer("score").notNull(),
  factors: jsonb("factors").$type<{
    engagement: number;
    dealValue: number;
    activityLevel: number;
    recency: number;
    completeness: number;
  }>(),
  recommendation: text("recommendation"),
  nextBestAction: text("next_best_action"),
  organizationId: integer("organization_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Files table for attachments
export const files = pgTable("files", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  size: integer("size"),
  objectPath: varchar("object_path", { length: 1000 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).$type<FileEntityType>().notNull(),
  entityId: integer("entity_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  ownedContacts: many(contacts),
  ownedDeals: many(deals),
  activities: many(activities),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  companies: many(companies),
  contacts: many(contacts),
  pipelines: many(pipelines),
  deals: many(deals),
  conversations: many(conversations),
  activities: many(activities),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [companies.ownerId],
    references: [users.id],
  }),
  contacts: many(contacts),
  deals: many(deals),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [contacts.ownerId],
    references: [users.id],
  }),
  deals: many(deals),
  conversations: many(conversations),
  activities: many(activities),
}));

export const pipelinesRelations = relations(pipelines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pipelines.organizationId],
    references: [organizations.id],
  }),
  stages: many(pipelineStages),
  deals: many(deals),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineStages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.stageId],
    references: [pipelineStages.id],
  }),
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [deals.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [deals.ownerId],
    references: [users.id],
  }),
  conversations: many(conversations),
  activities: many(activities),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [conversations.dealId],
    references: [deals.id],
  }),
  organization: one(organizations, {
    fields: [conversations.organizationId],
    references: [organizations.id],
  }),
  assignedTo: one(users, {
    fields: [conversations.assignedToId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [activities.dealId],
    references: [deals.id],
  }),
  organization: one(organizations, {
    fields: [activities.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const savedViewsRelations = relations(savedViews, ({ one }) => ({
  user: one(users, {
    fields: [savedViews.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [savedViews.organizationId],
    references: [organizations.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailTemplates.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  organization: one(organizations, {
    fields: [files.organizationId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
}));

export const leadScoresRelations = relations(leadScores, ({ one }) => ({
  organization: one(organizations, {
    fields: [leadScores.organizationId],
    references: [organizations.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [calendarEvents.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [calendarEvents.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [calendarEvents.dealId],
    references: [deals.id],
  }),
  activity: one(activities, {
    fields: [calendarEvents.activityId],
    references: [activities.id],
  }),
}));

export const channelConfigsRelations = relations(channelConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [channelConfigs.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [channelConfigs.createdBy],
    references: [users.id],
  }),
}));

export const googleOAuthTokensRelations = relations(googleOAuthTokens, ({ one }) => ({
  user: one(users, {
    fields: [googleOAuthTokens.userId],
    references: [users.id],
  }),
}));

// Insert schemas
// Nota: drizzle-zod 0.8.1 ja trata automaticamente:
// - Campos com generatedAlwaysAsIdentity() (id) - excluidos ou opcionais
// - Campos com defaultNow() (createdAt, updatedAt) - opcionais
// Para campos enum, usamos .extend() para garantir tipos corretos
export const insertUserSchema = createInsertSchema(users);
export const insertOrganizationSchema = createInsertSchema(organizations);
export const insertCompanySchema = createInsertSchema(companies);
export const insertContactSchema = createInsertSchema(contacts);
export const insertPipelineSchema = createInsertSchema(pipelines);
export const insertPipelineStageSchema = createInsertSchema(pipelineStages);
export const insertDealSchema = createInsertSchema(deals);
export const insertConversationSchema = createInsertSchema(conversations)
  .extend({ channel: z.enum(channelTypes) });
export const insertMessageSchema = createInsertSchema(messages)
  .extend({ contentType: z.enum(messageContentTypes).optional() });
export const insertActivitySchema = createInsertSchema(activities)
  .extend({ type: z.enum(activityTypes) });
export const insertNotificationSchema = createInsertSchema(notifications)
  .extend({ type: z.enum(notificationTypes) });
export const insertSavedViewSchema = createInsertSchema(savedViews)
  .extend({ type: z.enum(savedViewTypes) });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const insertAuditLogSchema = createInsertSchema(auditLogs)
  .extend({
    action: z.enum(auditLogActions),
    entityType: z.enum(auditLogEntityTypes),
  });
export const insertFileSchema = createInsertSchema(files)
  .extend({ entityType: z.enum(fileEntityTypes) });
export const insertLeadScoreSchema = createInsertSchema(leadScores)
  .extend({ entityType: z.enum(leadScoreEntityTypes) });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents)
  .extend({
    type: z.enum(calendarEventTypes).nullable().optional(),
    syncSource: z.enum(calendarSyncSources).nullable().optional(),
  });
export const insertChannelConfigSchema = createInsertSchema(channelConfigs)
  .extend({ type: z.enum(channelConfigTypes) });
export const insertPushTokenSchema = createInsertSchema(pushTokens);
export const insertGoogleOAuthTokenSchema = createInsertSchema(googleOAuthTokens)
  .extend({ syncStatus: z.enum(googleCalendarSyncStatuses).optional() });

// Update schemas
export const updateUserSchema = createUpdateSchema(users);
export const updateOrganizationSchema = createUpdateSchema(organizations);
export const updateCompanySchema = createUpdateSchema(companies);
export const updateContactSchema = createUpdateSchema(contacts);
export const updatePipelineSchema = createUpdateSchema(pipelines);
export const updatePipelineStageSchema = createUpdateSchema(pipelineStages);
export const updateDealSchema = createUpdateSchema(deals);
export const updateConversationSchema = createUpdateSchema(conversations)
  .extend({ channel: z.enum(channelTypes).optional() });
export const updateMessageSchema = createUpdateSchema(messages)
  .extend({ contentType: z.enum(messageContentTypes).optional() });
export const updateActivitySchema = createUpdateSchema(activities)
  .extend({ type: z.enum(activityTypes).optional() });
export const updateNotificationSchema = createUpdateSchema(notifications)
  .extend({ type: z.enum(notificationTypes).optional() });
export const updateSavedViewSchema = createUpdateSchema(savedViews)
  .extend({ type: z.enum(savedViewTypes).optional() });
export const updateEmailTemplateSchema = createUpdateSchema(emailTemplates);
export const updateAuditLogSchema = createUpdateSchema(auditLogs)
  .extend({
    action: z.enum(auditLogActions).optional(),
    entityType: z.enum(auditLogEntityTypes).optional(),
  });
export const updateFileSchema = createUpdateSchema(files)
  .extend({ entityType: z.enum(fileEntityTypes).optional() });
export const updateLeadScoreSchema = createUpdateSchema(leadScores)
  .extend({ entityType: z.enum(leadScoreEntityTypes).optional() });
export const updateCalendarEventSchema = createUpdateSchema(calendarEvents)
  .extend({
    type: z.enum(calendarEventTypes).nullable().optional(),
    syncSource: z.enum(calendarSyncSources).nullable().optional(),
  });
export const updateChannelConfigSchema = createUpdateSchema(channelConfigs)
  .extend({ type: z.enum(channelConfigTypes).optional() });
export const updatePushTokenSchema = createUpdateSchema(pushTokens);
export const updateGoogleOAuthTokenSchema = createUpdateSchema(googleOAuthTokens)
  .extend({ syncStatus: z.enum(googleCalendarSyncStatuses).optional() });

// Types - usamos z.infer para schemas com enum estendidos e $inferSelect para select types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;
export type SavedView = typeof savedViews.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;
export type LeadScore = typeof leadScores.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertChannelConfig = z.infer<typeof insertChannelConfigSchema>;
export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertGoogleOAuthToken = z.infer<typeof insertGoogleOAuthTokenSchema>;
export type GoogleOAuthToken = typeof googleOAuthTokens.$inferSelect;

export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;
export type UpdatePipelineStage = z.infer<typeof updatePipelineStageSchema>;
export type UpdateDeal = z.infer<typeof updateDealSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type UpdateActivity = z.infer<typeof updateActivitySchema>;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;
export type UpdateSavedView = z.infer<typeof updateSavedViewSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;
export type UpdateAuditLog = z.infer<typeof updateAuditLogSchema>;
export type UpdateFile = z.infer<typeof updateFileSchema>;
export type UpdateLeadScore = z.infer<typeof updateLeadScoreSchema>;
export type UpdateCalendarEvent = z.infer<typeof updateCalendarEventSchema>;
export type UpdateChannelConfig = z.infer<typeof updateChannelConfigSchema>;
export type UpdatePushToken = z.infer<typeof updatePushTokenSchema>;
export type UpdateGoogleOAuthToken = z.infer<typeof updateGoogleOAuthTokenSchema>;
