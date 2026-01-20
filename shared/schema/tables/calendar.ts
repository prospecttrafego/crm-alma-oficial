import { boolean, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import type { CalendarEventType, CalendarSyncSource, GoogleCalendarSyncStatus } from "../enums";
import { activities } from "./activities";
import { contacts } from "./contacts";
import { deals } from "./pipelines";
import { organizations } from "./organizations";
import { users } from "./auth";

// Calendar events table
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 20 }).$type<CalendarEventType>().default("meeting"),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    allDay: boolean("all_day").default(false),
    location: varchar("location", { length: 500 }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
    activityId: integer("activity_id").references(() => activities.id, { onDelete: "set null" }),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    attendees: text("attendees").array(),
    color: varchar("color", { length: 7 }),
    // Google Calendar sync fields
    googleEventId: varchar("google_event_id", { length: 255 }),
    googleCalendarId: varchar("google_calendar_id", { length: 255 }),
    syncSource: varchar("sync_source", { length: 20 }).$type<CalendarSyncSource>().default("local"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_calendar_events_org_start_time").on(table.organizationId, table.startTime),
  ],
);

// Google OAuth tokens table (per-user)
export const googleOAuthTokens = pgTable("google_oauth_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
