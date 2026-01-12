/**
 * Response payload types shared between backend and frontend.
 * These represent API response shapes that are not directly derived from insert/update DTOs.
 */

import type { Company, Contact, Conversation, Deal, Message, User } from "../schema";

export type SafeUser = Omit<User, "passwordHash">;

export type ContactWithCompany = Contact & {
  company?: Company | null;
};

export type ConversationWithRelations = Conversation & {
  contact?: ContactWithCompany | null;
  deal?: Deal | null;
  company?: Company | null;
  assignedTo?: SafeUser | null;
};

export type MessageWithSender = Message & {
  sender?: SafeUser | null;
};

export type MessagesResponse = {
  messages: MessageWithSender[];
  nextCursor: number | null;
  hasMore: boolean;
};

export type GoogleCalendarConfigured = {
  configured: boolean;
};

export type GoogleCalendarStatus = {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  syncStatus: string | null;
  syncError?: string | null;
};

export type GoogleCalendarAuth = {
  authUrl: string;
};

export type GoogleCalendarSyncResult = {
  imported?: number;
  updated?: number;
  deleted?: number;
  message?: string;
  jobId?: string | number;
  status?: string;
};
