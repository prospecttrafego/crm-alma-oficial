import {
  users,
  organizations,
  companies,
  contacts,
  pipelines,
  pipelineStages,
  deals,
  conversations,
  messages,
  activities,
  notifications,
  savedViews,
  emailTemplates,
  auditLogs,
  files,
  leadScores,
  calendarEvents,
  channelConfigs,
  pushTokens,
  googleOAuthTokens,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type Company,
  type InsertCompany,
  type Contact,
  type InsertContact,
  type Pipeline,
  type InsertPipeline,
  type PipelineStage,
  type InsertPipelineStage,
  type Deal,
  type InsertDeal,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Activity,
  type InsertActivity,
  type Notification,
  type InsertNotification,
  type SavedView,
  type InsertSavedView,
  type SavedViewType,
  type EmailTemplate,
  type InsertEmailTemplate,
  type AuditLog,
  type InsertAuditLog,
  type AuditLogEntityType,
  type File as FileRecord,
  type InsertFile,
  type FileEntityType,
  type LeadScore,
  type InsertLeadScore,
  type LeadScoreEntityType,
  type CalendarEvent,
  type InsertCalendarEvent,
  type ChannelConfig,
  type InsertChannelConfig,
  type PushToken,
  type InsertPushToken,
  type GoogleOAuthToken,
  type InsertGoogleOAuthToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, gte, lte, lt, asc, not, ilike, or } from "drizzle-orm";
import { getSingleTenantOrganizationId } from "./tenant";

// ========== PAGINACAO ==========

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePagination(params: PaginationParams): { page: number; limit: number; offset: number } {
  const page = Math.max(1, params.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUsers(organizationId: number): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, updates: {
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    preferences?: { language?: 'pt-BR' | 'en' };
  }): Promise<User | undefined>;

  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getDefaultOrganization(): Promise<Organization | undefined>;
  
  getCompanies(organizationId: number): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<void>;
  
  getContacts(organizationId: number): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
  
  getPipelines(organizationId: number): Promise<Pipeline[]>;
  getPipeline(id: number): Promise<Pipeline | undefined>;
  getDefaultPipeline(organizationId: number): Promise<Pipeline | undefined>;
  createPipeline(pipeline: InsertPipeline): Promise<Pipeline>;
  updatePipeline(id: number, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined>;
  deletePipeline(id: number): Promise<void>;
  setDefaultPipeline(id: number, organizationId: number): Promise<Pipeline | undefined>;
  getPipelineStages(pipelineId: number): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined>;
  deletePipelineStage(id: number): Promise<void>;
  
  getDeals(organizationId: number): Promise<Deal[]>;
  getDealsByPipeline(pipelineId: number): Promise<Deal[]>;
  getDeal(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<void>;
  moveDealToStage(dealId: number, stageId: number): Promise<Deal | undefined>;
  
  getConversations(organizationId: number): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, conversation: Partial<InsertConversation>): Promise<Conversation | undefined>;
  
  getMessages(conversationId: number, options?: { cursor?: number; limit?: number }): Promise<{ messages: Message[]; nextCursor: number | null; hasMore: boolean }>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(conversationId: number, userId: string): Promise<number>;
  
  getActivities(organizationId: number): Promise<Activity[]>;
  getActivity(id: number): Promise<Activity | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined>;
  deleteActivity(id: number): Promise<void>;
  
  getDashboardStats(organizationId: number): Promise<{
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    totalValue: string;
    contacts: number;
    companies: number;
    pendingActivities: number;
    unreadConversations: number;
  }>;
  
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  
  getSavedViews(userId: string, type: SavedViewType): Promise<SavedView[]>;
  getSavedView(id: number): Promise<SavedView | undefined>;
  createSavedView(view: InsertSavedView): Promise<SavedView>;
  updateSavedView(id: number, userId: string, view: Partial<InsertSavedView>): Promise<SavedView | undefined>;
  deleteSavedView(id: number, userId: string): Promise<void>;
  
  getEmailTemplates(organizationId: number): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, organizationId: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, organizationId: number, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number, organizationId: number): Promise<void>;
  
  getAuditLogs(organizationId: number, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: AuditLogEntityType, entityId: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  getReportData(organizationId: number, startDate: Date, endDate: Date): Promise<{
    dealsByStage: { stage: string; count: number; value: string }[];
    dealsOverTime: { date: string; count: number; value: string }[];
    conversionFunnel: { stage: string; deals: number; value: string; order: number }[];
    teamPerformance: { userId: string; name: string; deals: number; value: string; wonDeals: number }[];
    activitySummary: { type: string; count: number }[];
    wonLostByMonth: { month: string; won: number; lost: number; wonValue: string; lostValue: string }[];
  }>;
  
  getFiles(entityType: FileEntityType, entityId: number): Promise<FileRecord[]>;
  getFile(id: number): Promise<FileRecord | undefined>;
  createFile(file: InsertFile): Promise<FileRecord>;
  updateFile(id: number, updates: Partial<InsertFile>): Promise<FileRecord>;
  deleteFile(id: number): Promise<void>;
  
  getLeadScore(entityType: LeadScoreEntityType, entityId: number): Promise<LeadScore | undefined>;
  getLeadScores(organizationId: number): Promise<LeadScore[]>;
  createLeadScore(score: InsertLeadScore): Promise<LeadScore>;
  getContactScoringData(contactId: number): Promise<{
    activities: { totalActivities: number; completedActivities: number; pendingActivities: number; lastActivityDate: Date | null; activityTypes: Record<string, number> };
    conversations: { totalConversations: number; totalMessages: number; lastMessageDate: Date | null; channels: string[] };
    deals: { count: number; totalValue: number; wonDeals: number };
  }>;
  getDealScoringData(dealId: number): Promise<{
    deal: { id: number; title: string; value: string | null; stageName: string; stageOrder: number; totalStages: number; probability: number | null; status: string | null; contactName: string | null; companyName: string | null } | null;
    activities: { totalActivities: number; completedActivities: number; pendingActivities: number; lastActivityDate: Date | null; activityTypes: Record<string, number> };
    conversations: { totalConversations: number; totalMessages: number; lastMessageDate: Date | null; channels: string[] };
  }>;
  
  getCalendarEvents(organizationId: number, startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: number): Promise<void>;
  
  getChannelConfigs(organizationId: number): Promise<ChannelConfig[]>;
  getChannelConfig(id: number): Promise<ChannelConfig | undefined>;
  createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig>;
  updateChannelConfig(id: number, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined>;
  deleteChannelConfig(id: number): Promise<void>;
  updateChannelConfigLastSync(id: number): Promise<ChannelConfig | undefined>;

  getPushTokensForUser(userId: string): Promise<PushToken[]>;
  createPushToken(token: InsertPushToken): Promise<PushToken>;
  deletePushToken(token: string): Promise<void>;
  deletePushTokensForUser(userId: string): Promise<void>;
  updatePushTokenLastUsed(token: string): Promise<void>;

  // Google OAuth Tokens
  getGoogleOAuthToken(userId: string): Promise<GoogleOAuthToken | undefined>;
  createGoogleOAuthToken(token: InsertGoogleOAuthToken): Promise<GoogleOAuthToken>;
  updateGoogleOAuthToken(userId: string, updates: Partial<InsertGoogleOAuthToken>): Promise<GoogleOAuthToken | undefined>;
  deleteGoogleOAuthToken(userId: string): Promise<void>;

  // Calendar sync helpers
  getCalendarEventByGoogleId(googleEventId: string, userId: string): Promise<CalendarEvent | undefined>;
  getCalendarEventsForSync(userId: string, organizationId: number): Promise<CalendarEvent[]>;
}

export class DatabaseStorage implements IStorage {
  private async tenantOrganizationId(): Promise<number> {
    return getSingleTenantOrganizationId();
  }

  async getUser(id: string): Promise<User | undefined> {
    const organizationId = await this.tenantOrganizationId();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));
    return user;
  }

  async getUsers(organizationId: number): Promise<User[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(users)
      .where(eq(users.organizationId, tenantOrganizationId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const organizationId = await this.tenantOrganizationId();
    const [user] = await db
      .insert(users)
      .values({ ...userData, organizationId })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          organizationId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(id: string, updates: {
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    preferences?: { language?: 'pt-BR' | 'en' };
  }): Promise<User | undefined> {
    const organizationId = await this.tenantOrganizationId();
    // Get existing user to merge preferences
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.profileImageUrl !== undefined) updateData.profileImageUrl = updates.profileImageUrl;

    // Merge preferences with existing
    if (updates.preferences !== undefined) {
      const existingPrefs = (existing.preferences as Record<string, unknown>) || {};
      updateData.preferences = { ...existingPrefs, ...updates.preferences };
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const organizationId = await this.tenantOrganizationId();
    const [org] = await db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), eq(organizations.id, organizationId)));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async getDefaultOrganization(): Promise<Organization | undefined> {
    const organizationId = await this.tenantOrganizationId();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return org;
  }

  async getCompanies(organizationId: number): Promise<Company[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(companies)
      .where(eq(companies.organizationId, tenantOrganizationId));
  }

  async getCompaniesPaginated(
    organizationId: number,
    params: PaginationParams
  ): Promise<PaginatedResult<Company>> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { page, limit, offset } = normalizePagination(params);

    // Build search condition
    const searchCondition = params.search
      ? or(
          ilike(companies.name, `%${params.search}%`),
          ilike(companies.domain, `%${params.search}%`),
          ilike(companies.industry, `%${params.search}%`)
        )
      : undefined;

    const whereCondition = searchCondition
      ? and(eq(companies.organizationId, tenantOrganizationId), searchCondition)
      : eq(companies.organizationId, tenantOrganizationId);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(companies)
      .where(whereCondition);
    const total = Number(countResult?.count || 0);

    // Get paginated data
    const sortOrder = params.sortOrder === "asc" ? asc : desc;
    const data = await db
      .select()
      .from(companies)
      .where(whereCondition)
      .orderBy(sortOrder(companies.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.organizationId, tenantOrganizationId)));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(companies)
      .values({ ...company, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = company as Partial<
      InsertCompany & { organizationId?: number }
    >;
    const [updated] = await db
      .update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteCompany(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.organizationId, tenantOrganizationId)));
  }

  async getContacts(organizationId: number): Promise<Contact[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(contacts)
      .where(eq(contacts.organizationId, tenantOrganizationId));
  }

  async getContactsPaginated(
    organizationId: number,
    params: PaginationParams
  ): Promise<PaginatedResult<Contact>> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { page, limit, offset } = normalizePagination(params);

    // Build search condition
    const searchCondition = params.search
      ? or(
          ilike(contacts.firstName, `%${params.search}%`),
          ilike(contacts.lastName, `%${params.search}%`),
          ilike(contacts.email, `%${params.search}%`),
          ilike(contacts.phone, `%${params.search}%`)
        )
      : undefined;

    const whereCondition = searchCondition
      ? and(eq(contacts.organizationId, tenantOrganizationId), searchCondition)
      : eq(contacts.organizationId, tenantOrganizationId);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(whereCondition);
    const total = Number(countResult?.count || 0);

    // Get paginated data
    const sortOrder = params.sortOrder === "asc" ? asc : desc;
    const data = await db
      .select()
      .from(contacts)
      .where(whereCondition)
      .orderBy(sortOrder(contacts.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.organizationId, tenantOrganizationId)));
    return contact;
  }

  /**
   * Find contact by phone number (optimized for WhatsApp handler)
   * Searches for exact match or suffix match (to handle different formats)
   */
  async getContactByPhone(phone: string, organizationId: number): Promise<Contact | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();

    // Normalize phone (remove non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');

    // First try exact match
    const [exactMatch] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, tenantOrganizationId),
          sql`REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`
        )
      )
      .limit(1);

    if (exactMatch) return exactMatch;

    // Try suffix match (for numbers with/without country code)
    const [suffixMatch] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, tenantOrganizationId),
          or(
            sql`REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone}`,
            sql`${normalizedPhone} LIKE '%' || REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g')`
          )
        )
      )
      .limit(1);

    return suffixMatch;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(contacts)
      .values({ ...contact, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = contact as Partial<
      InsertContact & { organizationId?: number }
    >;
    const [updated] = await db
      .update(contacts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.organizationId, tenantOrganizationId)));
  }

  async getPipelines(organizationId: number): Promise<Pipeline[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.organizationId, tenantOrganizationId));
  }

  async getPipeline(id: number): Promise<Pipeline | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)));
    return pipeline;
  }

  async getDefaultPipeline(organizationId: number): Promise<Pipeline | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.organizationId, tenantOrganizationId), eq(pipelines.isDefault, true)));
    return pipeline;
  }

  async createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(pipelines)
      .values({ ...pipeline, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async getPipelineStages(pipelineId: number): Promise<PipelineStage[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const rows = await db
      .select()
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(
        and(
          eq(pipelineStages.pipelineId, pipelineId),
          eq(pipelines.organizationId, tenantOrganizationId),
        ),
      )
      .orderBy(pipelineStages.order);

    return rows.map((row) => row.pipeline_stages);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.id, stage.pipelineId), eq(pipelines.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const { pipelineId, ...insertData } = stage as InsertPipelineStage;
    const [created] = await db
      .insert(pipelineStages)
      .values({ ...insertData, pipelineId })
      .returning();
    return created;
  }

  async updatePipeline(id: number, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = pipeline as Partial<
      InsertPipeline & { organizationId?: number }
    >;
    const [updated] = await db
      .update(pipelines)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deletePipeline(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!pipeline) return;

    await db.delete(pipelineStages).where(eq(pipelineStages.pipelineId, id));
    await db
      .delete(pipelines)
      .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)));
  }

  async setDefaultPipeline(id: number, organizationId: number): Promise<Pipeline | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .update(pipelines)
      .set({ isDefault: false })
      .where(eq(pipelines.organizationId, tenantOrganizationId));
    const [updated] = await db
      .update(pipelines)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(pipelines.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [existing] = await db
      .select({ pipelineId: pipelineStages.pipelineId })
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(and(eq(pipelineStages.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!existing) return undefined;

    const { pipelineId: _pipelineId, ...updateData } = stage as Partial<
      InsertPipelineStage & { pipelineId?: number }
    >;
    const [updated] = await db
      .update(pipelineStages)
      .set(updateData)
      .where(and(eq(pipelineStages.id, id), eq(pipelineStages.pipelineId, existing.pipelineId)))
      .returning();
    return updated;
  }

  async deletePipelineStage(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [existing] = await db
      .select({ pipelineId: pipelineStages.pipelineId })
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(and(eq(pipelineStages.id, id), eq(pipelines.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!existing) return;

    await db
      .delete(pipelineStages)
      .where(and(eq(pipelineStages.id, id), eq(pipelineStages.pipelineId, existing.pipelineId)));
  }

  async getDeals(organizationId: number): Promise<Deal[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(deals)
      .where(eq(deals.organizationId, tenantOrganizationId));
  }

  async getDealsPaginated(
    organizationId: number,
    params: PaginationParams & { pipelineId?: number; stageId?: number; status?: string }
  ): Promise<PaginatedResult<Deal>> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { page, limit, offset } = normalizePagination(params);

    // Build conditions
    const conditions = [eq(deals.organizationId, tenantOrganizationId)];

    if (params.search) {
      conditions.push(ilike(deals.title, `%${params.search}%`));
    }
    if (params.pipelineId) {
      conditions.push(eq(deals.pipelineId, params.pipelineId));
    }
    if (params.stageId) {
      conditions.push(eq(deals.stageId, params.stageId));
    }
    if (params.status) {
      conditions.push(eq(deals.status, params.status as "open" | "won" | "lost"));
    }

    const whereCondition = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(deals)
      .where(whereCondition);
    const total = Number(countResult?.count || 0);

    // Get paginated data
    const sortOrder = params.sortOrder === "asc" ? asc : desc;
    const data = await db
      .select()
      .from(deals)
      .where(whereCondition)
      .orderBy(sortOrder(deals.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getDealsByPipeline(pipelineId: number): Promise<Deal[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(deals)
      .where(and(eq(deals.pipelineId, pipelineId), eq(deals.organizationId, tenantOrganizationId)));
  }

  async getDeal(id: number): Promise<Deal | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [deal] = await db
      .select()
      .from(deals)
      .where(and(eq(deals.id, id), eq(deals.organizationId, tenantOrganizationId)));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const tenantOrganizationId = await this.tenantOrganizationId();

    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.id, deal.pipelineId), eq(pipelines.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    const [stage] = await db
      .select({ id: pipelineStages.id })
      .from(pipelineStages)
      .where(and(eq(pipelineStages.id, deal.stageId), eq(pipelineStages.pipelineId, deal.pipelineId)))
      .limit(1);
    if (!stage) {
      throw new Error("Pipeline stage not found");
    }

    if (deal.contactId) {
      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, deal.contactId), eq(contacts.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!contact) throw new Error("Contact not found");
    }

    if (deal.companyId) {
      const [company] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, deal.companyId), eq(companies.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!company) throw new Error("Company not found");
    }

    const [created] = await db
      .insert(deals)
      .values({ ...deal, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = deal as Partial<
      InsertDeal & { organizationId?: number }
    >;
    const [updated] = await db
      .update(deals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteDeal(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(deals)
      .where(and(eq(deals.id, id), eq(deals.organizationId, tenantOrganizationId)));
  }

  async moveDealToStage(dealId: number, stageId: number): Promise<Deal | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();

    const [deal] = await db
      .select({ pipelineId: deals.pipelineId })
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!deal) return undefined;

    const [stage] = await db
      .select({
        pipelineId: pipelineStages.pipelineId,
        isWon: pipelineStages.isWon,
        isLost: pipelineStages.isLost,
      })
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(and(eq(pipelineStages.id, stageId), eq(pipelines.organizationId, tenantOrganizationId)))
      .limit(1);
    if (!stage) return undefined;

    if (stage.pipelineId !== deal.pipelineId) return undefined;
	    
	    let status = "open";
	    if (stage.isWon) status = "won";
	    if (stage.isLost) status = "lost";
	    
	    const [updated] = await db.update(deals)
	      .set({ stageId, status, updatedAt: new Date() })
	      .where(and(eq(deals.id, dealId), eq(deals.organizationId, tenantOrganizationId)))
	      .returning();
	    return updated;
  }

  async getConversations(organizationId: number): Promise<Conversation[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.organizationId, tenantOrganizationId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getConversationsPaginated(
    organizationId: number,
    params: PaginationParams & { status?: string; channel?: string; assignedToId?: string }
  ): Promise<PaginatedResult<Conversation>> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { page, limit, offset } = normalizePagination(params);

    // Build conditions
    const conditions = [eq(conversations.organizationId, tenantOrganizationId)];

    if (params.search) {
      conditions.push(ilike(conversations.subject, `%${params.search}%`));
    }
    if (params.status) {
      conditions.push(eq(conversations.status, params.status as "open" | "closed" | "pending"));
    }
    if (params.channel) {
      conditions.push(eq(conversations.channel, params.channel as "email" | "whatsapp" | "sms" | "internal" | "phone"));
    }
    if (params.assignedToId) {
      conditions.push(eq(conversations.assignedToId, params.assignedToId));
    }

    const whereCondition = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(whereCondition);
    const total = Number(countResult?.count || 0);

    // Get paginated data (ordered by lastMessageAt)
    const data = await db
      .select()
      .from(conversations)
      .where(whereCondition)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.organizationId, tenantOrganizationId)));
    return conversation;
  }

  /**
   * Find conversation by contact ID and channel (optimized for WhatsApp handler)
   */
  async getConversationByContactAndChannel(
    contactId: number,
    channel: string,
    organizationId: number
  ): Promise<Conversation | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, tenantOrganizationId),
          eq(conversations.contactId, contactId),
          eq(conversations.channel, channel as any)
        )
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(1);
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const tenantOrganizationId = await this.tenantOrganizationId();

    if (conversation.contactId) {
      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, conversation.contactId), eq(contacts.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!contact) throw new Error("Contact not found");
    }

    if (conversation.dealId) {
      const [deal] = await db
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.id, conversation.dealId), eq(deals.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!deal) throw new Error("Deal not found");
    }

    const [created] = await db
      .insert(conversations)
      .values({ ...conversation, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateConversation(id: number, conversation: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = conversation as Partial<
      InsertConversation & { organizationId?: number }
    >;
    const [updated] = await db
      .update(conversations)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async getMessages(
    conversationId: number,
    options?: { cursor?: number; limit?: number }
  ): Promise<{ messages: Message[]; nextCursor: number | null; hasMore: boolean }> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!conversation) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const limit = options?.limit || 30;
    const cursor = options?.cursor;

    // Buscar mensagens com limite + 1 para verificar se ha mais
    const conditions = [eq(messages.conversationId, conversationId)];

    if (cursor) {
      // Cursor-based: buscar mensagens com ID menor que o cursor (mais antigas)
      conditions.push(lt(messages.id, cursor));
    }

    const result = await db.select().from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.id))
      .limit(limit + 1);

    // Verificar se ha mais mensagens
    const hasMore = result.length > limit;
    const messageList = hasMore ? result.slice(0, limit) : result;

    // Determinar o proximo cursor (o menor ID do lote atual)
    const nextCursor = hasMore && messageList.length > 0
      ? messageList[messageList.length - 1].id
      : null;

    // Retornar mensagens em ordem cronologica (mais antigas primeiro)
    return {
      messages: messageList.reverse(),
      nextCursor,
      hasMore,
    };
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, message.conversationId), eq(conversations.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const [created] = await db.insert(messages).values(message).returning();
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date(), unreadCount: sql`${conversations.unreadCount} + 1` })
      .where(and(eq(conversations.id, message.conversationId), eq(conversations.organizationId, tenantOrganizationId)));
    return created;
  }

  async markMessagesAsRead(conversationId: number, userId: string): Promise<number> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!conversation) return 0;

    // Get unread messages that this user hasn't read yet
    const unreadMessages = await db.select({ id: messages.id, readBy: messages.readBy })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          not(sql`coalesce(${messages.readBy}, '{}'::text[]) @> ARRAY[${userId}]::text[]`)
        )
      );

    if (unreadMessages.length === 0) return 0;

    // Update each message to add user to readBy array
    for (const msg of unreadMessages) {
      const currentReadBy = msg.readBy || [];
      if (!currentReadBy.includes(userId)) {
        await db.update(messages)
          .set({ readBy: [...currentReadBy, userId] })
          .where(eq(messages.id, msg.id));
      }
    }

    // Reset unread count on conversation
    await db
      .update(conversations)
      .set({ unreadCount: 0 })
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, tenantOrganizationId)));

    return unreadMessages.length;
  }

  async getActivities(organizationId: number): Promise<Activity[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(activities)
      .where(eq(activities.organizationId, tenantOrganizationId))
      .orderBy(desc(activities.createdAt));
  }

  async getActivitiesPaginated(
    organizationId: number,
    params: PaginationParams & { type?: string; status?: string; userId?: string }
  ): Promise<PaginatedResult<Activity>> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { page, limit, offset } = normalizePagination(params);

    // Build conditions
    const conditions = [eq(activities.organizationId, tenantOrganizationId)];

    if (params.search) {
      conditions.push(ilike(activities.title, `%${params.search}%`));
    }
    if (params.type) {
      conditions.push(eq(activities.type, params.type as "call" | "email" | "meeting" | "note" | "task"));
    }
    if (params.status) {
      conditions.push(eq(activities.status, params.status as "pending" | "completed" | "cancelled"));
    }
    if (params.userId) {
      conditions.push(eq(activities.userId, params.userId));
    }

    const whereCondition = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(activities)
      .where(whereCondition);
    const total = Number(countResult?.count || 0);

    // Get paginated data
    const data = await db
      .select()
      .from(activities)
      .where(whereCondition)
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [activity] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.organizationId, tenantOrganizationId)));
    return activity;
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(activities)
      .values({ ...activity, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = activity as Partial<
      InsertActivity & { organizationId?: number }
    >;
    const [updated] = await db
      .update(activities)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(activities.id, id), eq(activities.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteActivity(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(activities)
      .where(and(eq(activities.id, id), eq(activities.organizationId, tenantOrganizationId)));
  }

  async getDashboardStats(organizationId: number): Promise<{
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    totalValue: string;
    contacts: number;
    companies: number;
    pendingActivities: number;
    unreadConversations: number;
  }> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [dealsStats] = await db.select({
      total: count(),
      open: sql<number>`count(*) filter (where ${deals.status} = 'open')`,
      won: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
      totalValue: sql<string>`coalesce(sum(${deals.value}), 0)`,
    }).from(deals).where(eq(deals.organizationId, tenantOrganizationId));

    const [contactsCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.organizationId, tenantOrganizationId));
    const [companiesCount] = await db.select({ count: count() }).from(companies).where(eq(companies.organizationId, tenantOrganizationId));
    const [pendingCount] = await db.select({ count: count() }).from(activities)
      .where(and(eq(activities.organizationId, tenantOrganizationId), eq(activities.status, "pending")));
    const [unreadCount] = await db.select({ 
      count: sql<number>`count(*) filter (where ${conversations.unreadCount} > 0)` 
    }).from(conversations).where(eq(conversations.organizationId, tenantOrganizationId));

    return {
      totalDeals: Number(dealsStats?.total) || 0,
      openDeals: Number(dealsStats?.open) || 0,
      wonDeals: Number(dealsStats?.won) || 0,
      totalValue: String(dealsStats?.totalValue || "0"),
      contacts: contactsCount?.count || 0,
      companies: companiesCount?.count || 0,
      pendingActivities: pendingCount?.count || 0,
      unreadConversations: Number(unreadCount?.count) || 0,
    };
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: number, userId: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getSavedViews(userId: string, type: SavedViewType): Promise<SavedView[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.userId, userId),
          eq(savedViews.type, type),
          eq(savedViews.organizationId, tenantOrganizationId),
        ),
      )
      .orderBy(savedViews.name);
  }

  async getSavedView(id: number): Promise<SavedView | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [view] = await db
      .select()
      .from(savedViews)
      .where(and(eq(savedViews.id, id), eq(savedViews.organizationId, tenantOrganizationId)));
    return view;
  }

  async createSavedView(view: InsertSavedView): Promise<SavedView> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(savedViews)
      .values({ ...view, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateSavedView(id: number, userId: string, view: Partial<InsertSavedView>): Promise<SavedView | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = view as Partial<
      InsertSavedView & { organizationId?: number }
    >;
    const [updated] = await db
      .update(savedViews)
      .set({ ...updateData, updatedAt: new Date() })
      .where(
        and(
          eq(savedViews.id, id),
          eq(savedViews.userId, userId),
          eq(savedViews.organizationId, tenantOrganizationId),
        ),
      )
      .returning();
    return updated;
  }

  async deleteSavedView(id: number, userId: string): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(savedViews)
      .where(
        and(
          eq(savedViews.id, id),
          eq(savedViews.userId, userId),
          eq(savedViews.organizationId, tenantOrganizationId),
        ),
      );
  }

  async getEmailTemplates(organizationId: number): Promise<EmailTemplate[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.organizationId, tenantOrganizationId))
      .orderBy(emailTemplates.name);
  }

  async getEmailTemplate(id: number, organizationId: number): Promise<EmailTemplate | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, tenantOrganizationId)));
    return template;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(emailTemplates)
      .values({ ...template, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateEmailTemplate(id: number, organizationId: number, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = template as Partial<
      InsertEmailTemplate & { organizationId?: number }
    >;
    const [updated] = await db
      .update(emailTemplates)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: number, organizationId: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, tenantOrganizationId)));
  }

  async getAuditLogs(organizationId: number, limit: number = 100): Promise<AuditLog[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, tenantOrganizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByEntity(entityType: AuditLogEntityType, entityId: number): Promise<AuditLog[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId),
          eq(auditLogs.organizationId, tenantOrganizationId),
        ),
      )
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(auditLogs)
      .values({ ...log, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async getReportData(organizationId: number, startDate: Date, endDate: Date): Promise<{
    dealsByStage: { stage: string; count: number; value: string }[];
    dealsOverTime: { date: string; count: number; value: string }[];
    conversionFunnel: { stage: string; deals: number; value: string; order: number }[];
    teamPerformance: { userId: string; name: string; deals: number; value: string; wonDeals: number }[];
    activitySummary: { type: string; count: number }[];
    wonLostByMonth: { month: string; won: number; lost: number; wonValue: string; lostValue: string }[];
  }> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const stages = await db.select().from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(eq(pipelines.organizationId, tenantOrganizationId))
      .orderBy(pipelineStages.order);

    const dealsByStage = await db.select({
      stageName: sql<string>`coalesce(${pipelineStages.name}, 'Unassigned')`,
      count: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
    })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`
      ))
      .groupBy(pipelineStages.name);

    const dealsOverTime = await db.select({
      date: sql<string>`date_trunc('day', ${deals.createdAt})::date::text`,
      count: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)`,
    })
      .from(deals)
      .where(and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`
      ))
      .groupBy(sql`date_trunc('day', ${deals.createdAt})`)
      .orderBy(sql`date_trunc('day', ${deals.createdAt})`);

    const conversionFunnel = await db.select({
      stage: sql<string>`coalesce(${pipelineStages.name}, 'Unassigned')`,
      deals: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
      order: sql<number>`coalesce(${pipelineStages.order}, 999)`,
    })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`
      ))
      .groupBy(pipelineStages.name, pipelineStages.order)
      .orderBy(sql`coalesce(${pipelineStages.order}, 999)`);

    const teamPerformance = await db.select({
      userId: sql<string>`coalesce(${users.id}, 'unassigned')`,
      firstName: users.firstName,
      lastName: users.lastName,
      deals: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
      wonDeals: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
    })
      .from(deals)
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`
      ))
      .groupBy(users.id, users.firstName, users.lastName);

    const activitySummary = await db.select({
      type: activities.type,
      count: count(),
    })
      .from(activities)
      .where(and(
        eq(activities.organizationId, tenantOrganizationId),
        sql`${activities.createdAt} >= ${startDate}`,
        sql`${activities.createdAt} <= ${endDate}`
      ))
      .groupBy(activities.type);

    const wonLostByMonth = await db.select({
      month: sql<string>`to_char(${deals.updatedAt}, 'YYYY-MM')`,
      won: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
      lost: sql<number>`count(*) filter (where ${deals.status} = 'lost')`,
      wonValue: sql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won'), 0)`,
      lostValue: sql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'lost'), 0)`,
    })
      .from(deals)
      .where(and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.updatedAt} >= ${startDate}`,
        sql`${deals.updatedAt} <= ${endDate}`
      ))
      .groupBy(sql`to_char(${deals.updatedAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${deals.updatedAt}, 'YYYY-MM')`);

    return {
      dealsByStage: dealsByStage.map(d => ({ stage: d.stageName, count: Number(d.count), value: String(d.value) })),
      dealsOverTime: dealsOverTime.map(d => ({ date: d.date, count: Number(d.count), value: String(d.value) })),
      conversionFunnel: conversionFunnel.map(d => ({ stage: d.stage, deals: Number(d.deals), value: String(d.value), order: d.order })),
      teamPerformance: teamPerformance.map(d => ({ 
        userId: d.userId, 
        name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown',
        deals: Number(d.deals), 
        value: String(d.value),
        wonDeals: Number(d.wonDeals)
      })),
      activitySummary: activitySummary.map(d => ({ type: d.type, count: Number(d.count) })),
      wonLostByMonth: wonLostByMonth.map(d => ({ 
        month: d.month, 
        won: Number(d.won), 
        lost: Number(d.lost),
        wonValue: String(d.wonValue),
        lostValue: String(d.lostValue)
      })),
    };
  }

  async getFiles(entityType: FileEntityType, entityId: number): Promise<FileRecord[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.entityType, entityType),
          eq(files.entityId, entityId),
          eq(files.organizationId, tenantOrganizationId),
        ),
      )
      .orderBy(desc(files.createdAt));
  }

  async getFile(id: number): Promise<FileRecord | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.organizationId, tenantOrganizationId)));
    return file;
  }

  async createFile(file: InsertFile): Promise<FileRecord> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(files)
      .values({ ...file, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateFile(id: number, updates: Partial<InsertFile>): Promise<FileRecord> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = updates as Partial<
      InsertFile & { organizationId?: number }
    >;
    const [updated] = await db
      .update(files)
      .set(updateData)
      .where(and(eq(files.id, id), eq(files.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteFile(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db.delete(files).where(and(eq(files.id, id), eq(files.organizationId, tenantOrganizationId)));
  }

  async getLeadScore(entityType: LeadScoreEntityType, entityId: number): Promise<LeadScore | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [score] = await db
      .select()
      .from(leadScores)
      .where(
        and(
          eq(leadScores.entityType, entityType),
          eq(leadScores.entityId, entityId),
          eq(leadScores.organizationId, tenantOrganizationId),
        ),
      )
      .orderBy(desc(leadScores.createdAt))
      .limit(1);
    return score;
  }

  async getLeadScores(organizationId: number): Promise<LeadScore[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(leadScores)
      .where(eq(leadScores.organizationId, tenantOrganizationId))
      .orderBy(desc(leadScores.createdAt));
  }

  async createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(leadScores)
      .values({ ...score, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async getContactScoringData(contactId: number): Promise<{
    activities: { totalActivities: number; completedActivities: number; pendingActivities: number; lastActivityDate: Date | null; activityTypes: Record<string, number> };
    conversations: { totalConversations: number; totalMessages: number; lastMessageDate: Date | null; channels: string[] };
    deals: { count: number; totalValue: number; wonDeals: number };
  }> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.organizationId, tenantOrganizationId)))
      .limit(1);

    if (!contact) {
      return {
        activities: {
          totalActivities: 0,
          completedActivities: 0,
          pendingActivities: 0,
          lastActivityDate: null,
          activityTypes: {},
        },
        conversations: {
          totalConversations: 0,
          totalMessages: 0,
          lastMessageDate: null,
          channels: [],
        },
        deals: {
          count: 0,
          totalValue: 0,
          wonDeals: 0,
        },
      };
    }

    const contactActivities = await db
      .select()
      .from(activities)
      .where(and(eq(activities.contactId, contactId), eq(activities.organizationId, tenantOrganizationId)));
    const contactConversations = await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.contactId, contactId), eq(conversations.organizationId, tenantOrganizationId)),
      );
    const contactDeals = await db
      .select()
      .from(deals)
      .where(and(eq(deals.contactId, contactId), eq(deals.organizationId, tenantOrganizationId)));

    const activityTypes: Record<string, number> = {};
    let lastActivityDate: Date | null = null;
    let completedActivities = 0;
    let pendingActivities = 0;

    contactActivities.forEach(a => {
      activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
      if (a.status === 'completed') completedActivities++;
      else pendingActivities++;
      if (a.createdAt && (!lastActivityDate || a.createdAt > lastActivityDate)) {
        lastActivityDate = a.createdAt;
      }
    });

    let totalMessages = 0;
    let lastMessageDate: Date | null = null;
    const channels: Set<string> = new Set();

    for (const conv of contactConversations) {
      channels.add(conv.channel);
      const convMessages = await db.select().from(messages).where(eq(messages.conversationId, conv.id));
      totalMessages += convMessages.length;
      convMessages.forEach(m => {
        if (m.createdAt && (!lastMessageDate || m.createdAt > lastMessageDate)) {
          lastMessageDate = m.createdAt;
        }
      });
    }

    let totalValue = 0;
    let wonDeals = 0;
    contactDeals.forEach(d => {
      if (d.value) totalValue += parseFloat(d.value);
      if (d.status === 'won') wonDeals++;
    });

    return {
      activities: {
        totalActivities: contactActivities.length,
        completedActivities,
        pendingActivities,
        lastActivityDate,
        activityTypes
      },
      conversations: {
        totalConversations: contactConversations.length,
        totalMessages,
        lastMessageDate,
        channels: Array.from(channels)
      },
      deals: {
        count: contactDeals.length,
        totalValue,
        wonDeals
      }
    };
  }

  async getDealScoringData(dealId: number): Promise<{
    deal: { id: number; title: string; value: string | null; stageName: string; stageOrder: number; totalStages: number; probability: number | null; status: string | null; contactName: string | null; companyName: string | null } | null;
    activities: { totalActivities: number; completedActivities: number; pendingActivities: number; lastActivityDate: Date | null; activityTypes: Record<string, number> };
    conversations: { totalConversations: number; totalMessages: number; lastMessageDate: Date | null; channels: string[] };
  }> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [dealRecord] = await db
      .select()
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.organizationId, tenantOrganizationId)));
    if (!dealRecord) {
      return {
        deal: null,
        activities: { totalActivities: 0, completedActivities: 0, pendingActivities: 0, lastActivityDate: null, activityTypes: {} },
        conversations: { totalConversations: 0, totalMessages: 0, lastMessageDate: null, channels: [] }
      };
    }

    const [stage] = await db
      .select()
      .from(pipelineStages)
      .where(
        and(eq(pipelineStages.id, dealRecord.stageId), eq(pipelineStages.pipelineId, dealRecord.pipelineId)),
      );
    const allStagesRows = await db
      .select()
      .from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(and(eq(pipelineStages.pipelineId, dealRecord.pipelineId), eq(pipelines.organizationId, tenantOrganizationId)));
    const allStages = allStagesRows.map((row) => row.pipeline_stages);

    let contactName: string | null = null;
    let companyName: string | null = null;
    if (dealRecord.contactId) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, dealRecord.contactId), eq(contacts.organizationId, tenantOrganizationId)));
      if (contact) contactName = `${contact.firstName} ${contact.lastName || ''}`.trim();
    }
    if (dealRecord.companyId) {
      const [company] = await db
        .select()
        .from(companies)
        .where(and(eq(companies.id, dealRecord.companyId), eq(companies.organizationId, tenantOrganizationId)));
      if (company) companyName = company.name;
    }

    const dealActivities = await db
      .select()
      .from(activities)
      .where(and(eq(activities.dealId, dealId), eq(activities.organizationId, tenantOrganizationId)));
    const dealConversations = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.dealId, dealId), eq(conversations.organizationId, tenantOrganizationId)));

    const activityTypes: Record<string, number> = {};
    let lastActivityDate: Date | null = null;
    let completedActivities = 0;
    let pendingActivities = 0;

    dealActivities.forEach(a => {
      activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
      if (a.status === 'completed') completedActivities++;
      else pendingActivities++;
      if (a.createdAt && (!lastActivityDate || a.createdAt > lastActivityDate)) {
        lastActivityDate = a.createdAt;
      }
    });

    let totalMessages = 0;
    let lastMessageDate: Date | null = null;
    const channels: Set<string> = new Set();

    for (const conv of dealConversations) {
      channels.add(conv.channel);
      const convMessages = await db.select().from(messages).where(eq(messages.conversationId, conv.id));
      totalMessages += convMessages.length;
      convMessages.forEach(m => {
        if (m.createdAt && (!lastMessageDate || m.createdAt > lastMessageDate)) {
          lastMessageDate = m.createdAt;
        }
      });
    }

    return {
      deal: {
        id: dealRecord.id,
        title: dealRecord.title,
        value: dealRecord.value,
        stageName: stage?.name || 'Unknown',
        stageOrder: stage?.order || 0,
        totalStages: allStages.length,
        probability: dealRecord.probability,
        status: dealRecord.status,
        contactName,
        companyName
      },
      activities: {
        totalActivities: dealActivities.length,
        completedActivities,
        pendingActivities,
        lastActivityDate,
        activityTypes
      },
      conversations: {
        totalConversations: dealConversations.length,
        totalMessages,
        lastMessageDate,
        channels: Array.from(channels)
      }
    };
  }

  async getCalendarEvents(organizationId: number, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.organizationId, tenantOrganizationId),
          gte(calendarEvents.startTime, startDate),
          lte(calendarEvents.endTime, endDate),
        ),
      )
      .orderBy(calendarEvents.startTime);
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, tenantOrganizationId)));
    return event;
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const tenantOrganizationId = await this.tenantOrganizationId();

    if (event.contactId) {
      const [contact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, event.contactId), eq(contacts.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!contact) throw new Error("Contact not found");
    }

    if (event.dealId) {
      const [deal] = await db
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.id, event.dealId), eq(deals.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!deal) throw new Error("Deal not found");
    }

    if (event.activityId) {
      const [activity] = await db
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.id, event.activityId), eq(activities.organizationId, tenantOrganizationId)))
        .limit(1);
      if (!activity) throw new Error("Activity not found");
    }

    const [created] = await db
      .insert(calendarEvents)
      .values({ ...event, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const { organizationId: _organizationId, ...updateData } = event as Partial<
      InsertCalendarEvent & { organizationId?: number }
    >;
    const [updated] = await db
      .update(calendarEvents)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteCalendarEvent(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.organizationId, tenantOrganizationId)));
  }

  async getChannelConfigs(organizationId: number): Promise<ChannelConfig[]> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(channelConfigs)
      .where(eq(channelConfigs.organizationId, tenantOrganizationId))
      .orderBy(desc(channelConfigs.createdAt));
  }

  async getChannelConfig(id: number): Promise<ChannelConfig | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [config] = await db
      .select()
      .from(channelConfigs)
      .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)));
    return config;
  }

  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [created] = await db
      .insert(channelConfigs)
      .values({ ...config, organizationId: tenantOrganizationId })
      .returning();
    return created;
  }

  async updateChannelConfig(id: number, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    // Fetch existing config to merge nested JSONB objects (preserves secrets if not provided)
    const [existing] = await db
      .select()
      .from(channelConfigs)
      .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)));
    if (!existing) return undefined;

    const updateData: Partial<InsertChannelConfig> = { ...config };

    // Merge email config - preserve password if not provided or empty in update
    if (config.emailConfig && existing.emailConfig) {
      const existingEmailConfig = existing.emailConfig as Record<string, unknown>;
      const newEmailConfig = config.emailConfig as Record<string, unknown>;
      // Treat undefined, null, and empty string as "preserve existing"
      const newPassword = newEmailConfig.password;
      if ((newPassword === undefined || newPassword === null || newPassword === "") && existingEmailConfig.password) {
        const mergedConfig = { ...newEmailConfig };
        delete mergedConfig.password; // Remove empty password field
        updateData.emailConfig = { ...mergedConfig, password: existingEmailConfig.password } as typeof config.emailConfig;
      }
    }

    // Merge whatsapp config - preserve accessToken if not provided or empty in update
    if (config.whatsappConfig && existing.whatsappConfig) {
      const existingWhatsappConfig = existing.whatsappConfig as Record<string, unknown>;
      const newWhatsappConfig = config.whatsappConfig as Record<string, unknown>;
      // Treat undefined, null, and empty string as "preserve existing"
      const newToken = newWhatsappConfig.accessToken;
      if ((newToken === undefined || newToken === null || newToken === "") && existingWhatsappConfig.accessToken) {
        const mergedConfig = { ...newWhatsappConfig };
        delete mergedConfig.accessToken; // Remove empty token field
        updateData.whatsappConfig = { ...mergedConfig, accessToken: existingWhatsappConfig.accessToken } as typeof config.whatsappConfig;
      }
    }

    const { organizationId: _organizationId, ...finalUpdate } = updateData as Partial<
      InsertChannelConfig & { organizationId?: number }
    >;

    const [updated] = await db
      .update(channelConfigs)
      .set({ ...finalUpdate, updatedAt: new Date() })
      .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async deleteChannelConfig(id: number): Promise<void> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    await db
      .delete(channelConfigs)
      .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)));
  }

  async updateChannelConfigLastSync(id: number): Promise<ChannelConfig | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [updated] = await db
      .update(channelConfigs)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(and(eq(channelConfigs.id, id), eq(channelConfigs.organizationId, tenantOrganizationId)))
      .returning();
    return updated;
  }

  async getPushTokensForUser(userId: string): Promise<PushToken[]> {
    return await db.select().from(pushTokens)
      .where(eq(pushTokens.userId, userId))
      .orderBy(desc(pushTokens.lastUsedAt));
  }

  async createPushToken(token: InsertPushToken): Promise<PushToken> {
    // Check if token already exists for this user
    const existing = await db.select().from(pushTokens)
      .where(and(
        eq(pushTokens.userId, token.userId),
        eq(pushTokens.token, token.token)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update lastUsedAt
      const [updated] = await db.update(pushTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushTokens.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(pushTokens).values(token).returning();
    return created;
  }

  async deletePushToken(token: string): Promise<void> {
    await db.delete(pushTokens).where(eq(pushTokens.token, token));
  }

  async deletePushTokensForUser(userId: string): Promise<void> {
    await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
  }

  async updatePushTokenLastUsed(token: string): Promise<void> {
    await db.update(pushTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushTokens.token, token));
  }

  // Google OAuth Tokens
  async getGoogleOAuthToken(userId: string): Promise<GoogleOAuthToken | undefined> {
    const [token] = await db.select().from(googleOAuthTokens)
      .where(eq(googleOAuthTokens.userId, userId));
    return token;
  }

  async createGoogleOAuthToken(token: InsertGoogleOAuthToken): Promise<GoogleOAuthToken> {
    // Delete existing token for this user first (one token per user)
    await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, token.userId));

    const [created] = await db.insert(googleOAuthTokens).values(token).returning();
    return created;
  }

  async updateGoogleOAuthToken(userId: string, updates: Partial<InsertGoogleOAuthToken>): Promise<GoogleOAuthToken | undefined> {
    const [updated] = await db.update(googleOAuthTokens)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(googleOAuthTokens.userId, userId))
      .returning();
    return updated;
  }

  async deleteGoogleOAuthToken(userId: string): Promise<void> {
    await db.delete(googleOAuthTokens).where(eq(googleOAuthTokens.userId, userId));
  }

  // Calendar sync helpers
  async getCalendarEventByGoogleId(googleEventId: string, userId: string): Promise<CalendarEvent | undefined> {
    const tenantOrganizationId = await this.tenantOrganizationId();
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.googleEventId, googleEventId),
          eq(calendarEvents.userId, userId),
          eq(calendarEvents.organizationId, tenantOrganizationId),
        ),
      );
    return event;
  }

  async getCalendarEventsForSync(userId: string, organizationId: number): Promise<CalendarEvent[]> {
    // Get events that were created locally (syncSource = 'local') and need to be synced to Google
    const tenantOrganizationId = await this.tenantOrganizationId();
    return await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, userId),
          eq(calendarEvents.organizationId, tenantOrganizationId),
          eq(calendarEvents.syncSource, 'local'),
        ),
      )
      .orderBy(desc(calendarEvents.startTime));
  }
}

export const storage = new DatabaseStorage();
