import type {
  User,
  UpsertUser,
  PasswordResetToken,
  InsertPasswordResetToken,
  Organization,
  InsertOrganization,
  Company,
  InsertCompany,
  Contact,
  InsertContact,
  Pipeline,
  InsertPipeline,
  PipelineStage,
  InsertPipelineStage,
  Deal,
  InsertDeal,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  Activity,
  InsertActivity,
  Notification,
  InsertNotification,
  SavedView,
  InsertSavedView,
  SavedViewType,
  EmailTemplate,
  InsertEmailTemplate,
  AuditLog,
  InsertAuditLog,
  AuditLogEntityType,
  File as FileRecord,
  InsertFile,
  FileEntityType,
  LeadScore,
  InsertLeadScore,
  LeadScoreEntityType,
  CalendarEvent,
  InsertCalendarEvent,
  ChannelConfig,
  InsertChannelConfig,
  PushToken,
  InsertPushToken,
  GoogleOAuthToken,
  InsertGoogleOAuthToken,
} from "@shared/schema";
import type { PaginationParams, PaginatedResult } from "./storage/helpers";
import type { UpdateUserProfileInput } from "./storage/users";
import type { ContactWithStats } from "./storage/contacts";
import type { AuditLogsFilters, PaginatedAuditLogsResult } from "./storage/auditLogs";

import * as usersStorage from "./storage/users";
import * as organizationsStorage from "./storage/organizations";
import * as companiesStorage from "./storage/companies";
import * as contactsStorage from "./storage/contacts";
import * as pipelinesStorage from "./storage/pipelines";
import * as dealsStorage from "./storage/deals";
import * as conversationsStorage from "./storage/conversations";
import * as activitiesStorage from "./storage/activities";
import * as reportsStorage from "./storage/reports";
import * as notificationsStorage from "./storage/notifications";
import * as savedViewsStorage from "./storage/savedViews";
import * as emailTemplatesStorage from "./storage/emailTemplates";
import * as auditLogsStorage from "./storage/auditLogs";
import * as filesStorage from "./storage/files";
import * as leadScoresStorage from "./storage/leadScores";
import * as calendarEventsStorage from "./storage/calendarEvents";
import * as channelConfigsStorage from "./storage/channelConfigs";
import * as pushTokensStorage from "./storage/pushTokens";
import * as googleOAuthTokensStorage from "./storage/googleOAuthTokens";
import * as passwordResetTokensStorage from "./storage/passwordResetTokens";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUsers(organizationId: number): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, updates: UpdateUserProfileInput): Promise<User | undefined>;

  // Organizations
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getDefaultOrganization(): Promise<Organization | undefined>;

  // Companies
  getCompanies(organizationId: number): Promise<Company[]>;
  getCompaniesPaginated(
    organizationId: number,
    params: PaginationParams,
  ): Promise<PaginatedResult<Company>>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyByName(name: string, organizationId: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;

  // Contacts
  getContacts(organizationId: number): Promise<Contact[]>;
  getContactsWithStats(organizationId: number): Promise<ContactWithStats[]>;
  getContactsPaginated(
    organizationId: number,
    params: PaginationParams,
  ): Promise<PaginatedResult<Contact>>;
  getContactsPaginatedWithStats(
    organizationId: number,
    params: PaginationParams,
  ): Promise<PaginatedResult<ContactWithStats>>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByPhone(phone: string, organizationId: number): Promise<Contact | undefined>;
  getContactByEmail(email: string, organizationId: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;

  // Pipelines
  getPipelines(organizationId: number): Promise<Pipeline[]>;
  getPipeline(id: number): Promise<Pipeline | undefined>;
  getDefaultPipeline(organizationId: number): Promise<Pipeline | undefined>;
  createPipeline(pipeline: InsertPipeline): Promise<Pipeline>;
  updatePipeline(id: number, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined>;
  deletePipeline(id: number): Promise<void>;
  setDefaultPipeline(id: number, organizationId: number): Promise<Pipeline | undefined>;
  getPipelineStages(pipelineId: number): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(
    id: number,
    stage: Partial<InsertPipelineStage>,
  ): Promise<PipelineStage | undefined>;
  deletePipelineStage(id: number): Promise<void>;

  // Deals
  getDeals(organizationId: number): Promise<Deal[]>;
  getDealsPaginated(
    organizationId: number,
    params: PaginationParams & { pipelineId?: number; stageId?: number; status?: string },
  ): Promise<PaginatedResult<Deal>>;
  getDealsByPipeline(pipelineId: number): Promise<Deal[]>;
  getDeal(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<void>;
  moveDealToStage(dealId: number, stageId: number, options?: { status?: "open" | "won" | "lost"; lostReason?: string }): Promise<Deal | undefined>;
  getDealsByContact(contactId: number): Promise<Deal[]>;
  unlinkDealsFromContact(contactId: number): Promise<number>;

  // Conversations
  getConversations(organizationId: number): Promise<Conversation[]>;
  getConversationsPaginated(
    organizationId: number,
    params: PaginationParams & { status?: string; channel?: string; assignedToId?: string },
  ): Promise<PaginatedResult<Conversation>>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationByContactAndChannel(
    contactId: number,
    channel: string,
    organizationId: number,
  ): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(
    id: number,
    conversation: Partial<InsertConversation>,
  ): Promise<Conversation | undefined>;
  getMessages(
    conversationId: number,
    options?: { cursor?: number; limit?: number },
  ): Promise<{ messages: Message[]; nextCursor: number | null; hasMore: boolean }>;
  getMessageByExternalId(externalId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(conversationId: number, userId: string): Promise<number>;
  getConversationsByContact(contactId: number): Promise<Conversation[]>;
  deleteMessagesByConversation(conversationId: number): Promise<number>;
  deleteConversationsByContact(contactId: number): Promise<number>;
  searchMessages(
    query: string,
    options?: { conversationId?: number; limit?: number; offset?: number },
  ): Promise<{ results: conversationsStorage.MessageSearchResult[]; total: number }>;
  getMessage(id: number): Promise<Message | undefined>;
  updateMessage(id: number, senderId: string, newContent: string): Promise<Message | undefined>;
  softDeleteMessage(id: number, senderId: string): Promise<Message | undefined>;

  // Activities
  getActivities(organizationId: number): Promise<Activity[]>;
  getActivitiesPaginated(
    organizationId: number,
    params: PaginationParams & { type?: string; status?: string; userId?: string },
  ): Promise<PaginatedResult<Activity>>;
  getActivity(id: number): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: number): Promise<void>;
  getActivitiesByContact(contactId: number): Promise<Activity[]>;
  deleteActivitiesByContact(contactId: number): Promise<number>;

  // Reports
  getDashboardStats(organizationId: number): Promise<{
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalValue: number;
    contacts: number;
    companies: number;
    newContacts: number;
    pendingActivities: number;
    openConversations: number;
    unreadConversations: number;
  }>;
  getReportData(
    organizationId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    dealsByStage: { stage: string; count: number; value: string }[];
    dealsOverTime: { date: string; count: number; value: string }[];
    conversionFunnel: { stage: string; deals: number; value: string; order: number }[];
    teamPerformance: { userId: string; name: string; deals: number; value: string; wonDeals: number }[];
    activitySummary: { type: string; count: number }[];
    wonLostByMonth: { month: string; won: number; lost: number; wonValue: string; lostValue: string }[];
  }>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Saved views
  getSavedViews(userId: string, type: SavedViewType): Promise<SavedView[]>;
  getSavedView(id: number): Promise<SavedView | undefined>;
  createSavedView(view: InsertSavedView): Promise<SavedView>;
  updateSavedView(
    id: number,
    userId: string,
    view: Partial<InsertSavedView>,
  ): Promise<SavedView | undefined>;
  deleteSavedView(id: number, userId: string): Promise<void>;

  // Email templates
  getEmailTemplates(organizationId: number): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, organizationId: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(
    id: number,
    organizationId: number,
    template: Partial<InsertEmailTemplate>,
  ): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number, organizationId: number): Promise<void>;

  // Audit logs
  getAuditLogs(organizationId: number, limit?: number): Promise<AuditLog[]>;
  getAuditLogsPaginated(filters: AuditLogsFilters, page?: number, limit?: number): Promise<PaginatedAuditLogsResult>;
  getAuditLogsByEntity(entityType: AuditLogEntityType, entityId: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Files
  getFiles(entityType: FileEntityType, entityId: number): Promise<FileRecord[]>;
  getFile(id: number): Promise<FileRecord | undefined>;
  createFile(file: InsertFile): Promise<FileRecord>;
  updateFile(id: number, updates: Partial<InsertFile>): Promise<FileRecord>;
  deleteFile(id: number): Promise<void>;
  deleteFilesByEntity(entityType: FileEntityType, entityId: number): Promise<number>;

  // Lead scores
  getLeadScore(entityType: LeadScoreEntityType, entityId: number): Promise<LeadScore | undefined>;
  getLeadScores(organizationId: number): Promise<LeadScore[]>;
  createLeadScore(score: InsertLeadScore): Promise<LeadScore>;
  getContactScoringData(contactId: number): Promise<{
    activities: {
      totalActivities: number;
      completedActivities: number;
      pendingActivities: number;
      lastActivityDate: Date | null;
      activityTypes: Record<string, number>;
    };
    conversations: {
      totalConversations: number;
      totalMessages: number;
      lastMessageDate: Date | null;
      channels: string[];
    };
    deals: { count: number; totalValue: number; wonDeals: number };
  }>;
  getDealScoringData(dealId: number): Promise<{
    deal: {
      id: number;
      title: string;
      value: string | null;
      stageName: string;
      stageOrder: number;
      totalStages: number;
      probability: number | null;
      status: string | null;
      contactName: string | null;
      companyName: string | null;
    } | null;
    activities: {
      totalActivities: number;
      completedActivities: number;
      pendingActivities: number;
      lastActivityDate: Date | null;
      activityTypes: Record<string, number>;
    };
    conversations: {
      totalConversations: number;
      totalMessages: number;
      lastMessageDate: Date | null;
      channels: string[];
    };
  }>;

  // Calendar events
  getCalendarEvents(organizationId: number, startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(
    id: number,
    event: Partial<InsertCalendarEvent>,
  ): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: number): Promise<void>;
  getCalendarEventByGoogleId(
    googleEventId: string,
    userId: string,
  ): Promise<CalendarEvent | undefined>;
  getCalendarEventsForSync(userId: string, organizationId: number): Promise<CalendarEvent[]>;

  // Channel configs
  getChannelConfigs(organizationId: number): Promise<ChannelConfig[]>;
  getChannelConfig(id: number): Promise<ChannelConfig | undefined>;
  createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig>;
  updateChannelConfig(
    id: number,
    config: Partial<InsertChannelConfig>,
  ): Promise<ChannelConfig | undefined>;
  deleteChannelConfig(id: number): Promise<void>;
  updateChannelConfigLastSync(id: number): Promise<ChannelConfig | undefined>;

  // Push tokens
  getPushTokensForUser(userId: string): Promise<PushToken[]>;
  createPushToken(token: InsertPushToken): Promise<PushToken>;
  deletePushToken(token: string): Promise<void>;
  deletePushTokensForUser(userId: string): Promise<void>;
  updatePushTokenLastUsed(token: string): Promise<void>;

  // Google OAuth Tokens
  getGoogleOAuthToken(userId: string): Promise<GoogleOAuthToken | undefined>;
  createGoogleOAuthToken(token: InsertGoogleOAuthToken): Promise<GoogleOAuthToken>;
  updateGoogleOAuthToken(
    userId: string,
    updates: Partial<InsertGoogleOAuthToken>,
  ): Promise<GoogleOAuthToken | undefined>;
  deleteGoogleOAuthToken(userId: string): Promise<void>;

  // Password reset tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getValidPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<number>;
}

export const storage = {
  ...usersStorage,
  ...organizationsStorage,
  ...companiesStorage,
  ...contactsStorage,
  ...pipelinesStorage,
  ...dealsStorage,
  ...conversationsStorage,
  ...activitiesStorage,
  ...reportsStorage,
  ...notificationsStorage,
  ...savedViewsStorage,
  ...emailTemplatesStorage,
  ...auditLogsStorage,
  ...filesStorage,
  ...leadScoresStorage,
  ...calendarEventsStorage,
  ...channelConfigsStorage,
  ...pushTokensStorage,
  ...googleOAuthTokensStorage,
  ...passwordResetTokensStorage,
} satisfies IStorage;
