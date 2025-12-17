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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, gte, lte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUsers(organizationId: number): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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
  
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(organizationId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async getDefaultOrganization(): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).limit(1);
    return org;
  }

  async getCompanies(organizationId: number): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.organizationId, organizationId));
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set({ ...company, updatedAt: new Date() }).where(eq(companies.id, id)).returning();
    return updated;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getContacts(organizationId: number): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact | undefined> {
    const [updated] = await db.update(contacts).set({ ...contact, updatedAt: new Date() }).where(eq(contacts.id, id)).returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getPipelines(organizationId: number): Promise<Pipeline[]> {
    return await db.select().from(pipelines).where(eq(pipelines.organizationId, organizationId));
  }

  async getPipeline(id: number): Promise<Pipeline | undefined> {
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id));
    return pipeline;
  }

  async getDefaultPipeline(organizationId: number): Promise<Pipeline | undefined> {
    const [pipeline] = await db.select().from(pipelines)
      .where(and(eq(pipelines.organizationId, organizationId), eq(pipelines.isDefault, true)));
    return pipeline;
  }

  async createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
    const [created] = await db.insert(pipelines).values(pipeline).returning();
    return created;
  }

  async getPipelineStages(pipelineId: number): Promise<PipelineStage[]> {
    return await db.select().from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(pipelineStages.order);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [created] = await db.insert(pipelineStages).values(stage).returning();
    return created;
  }

  async updatePipeline(id: number, pipeline: Partial<InsertPipeline>): Promise<Pipeline | undefined> {
    const [updated] = await db.update(pipelines).set({ ...pipeline, updatedAt: new Date() }).where(eq(pipelines.id, id)).returning();
    return updated;
  }

  async deletePipeline(id: number): Promise<void> {
    await db.delete(pipelineStages).where(eq(pipelineStages.pipelineId, id));
    await db.delete(pipelines).where(eq(pipelines.id, id));
  }

  async setDefaultPipeline(id: number, organizationId: number): Promise<Pipeline | undefined> {
    await db.update(pipelines).set({ isDefault: false }).where(eq(pipelines.organizationId, organizationId));
    const [updated] = await db.update(pipelines).set({ isDefault: true, updatedAt: new Date() }).where(eq(pipelines.id, id)).returning();
    return updated;
  }

  async updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage | undefined> {
    const [updated] = await db.update(pipelineStages).set(stage).where(eq(pipelineStages.id, id)).returning();
    return updated;
  }

  async deletePipelineStage(id: number): Promise<void> {
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  }

  async getDeals(organizationId: number): Promise<Deal[]> {
    return await db.select().from(deals).where(eq(deals.organizationId, organizationId));
  }

  async getDealsByPipeline(pipelineId: number): Promise<Deal[]> {
    return await db.select().from(deals).where(eq(deals.pipelineId, pipelineId));
  }

  async getDeal(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  async updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [updated] = await db.update(deals).set({ ...deal, updatedAt: new Date() }).where(eq(deals.id, id)).returning();
    return updated;
  }

  async deleteDeal(id: number): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async moveDealToStage(dealId: number, stageId: number): Promise<Deal | undefined> {
    const stage = await db.select().from(pipelineStages).where(eq(pipelineStages.id, stageId));
    if (!stage.length) return undefined;
    
    let status = "open";
    if (stage[0].isWon) status = "won";
    if (stage[0].isLost) status = "lost";
    
    const [updated] = await db.update(deals)
      .set({ stageId, status, updatedAt: new Date() })
      .where(eq(deals.id, dealId))
      .returning();
    return updated;
  }

  async getConversations(organizationId: number): Promise<Conversation[]> {
    return await db.select().from(conversations)
      .where(eq(conversations.organizationId, organizationId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(conversation).returning();
    return created;
  }

  async updateConversation(id: number, conversation: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [updated] = await db.update(conversations).set({ ...conversation, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
    return updated;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    await db.update(conversations)
      .set({ lastMessageAt: new Date(), unreadCount: sql`${conversations.unreadCount} + 1` })
      .where(eq(conversations.id, message.conversationId));
    return created;
  }

  async getActivities(organizationId: number): Promise<Activity[]> {
    return await db.select().from(activities)
      .where(eq(activities.organizationId, organizationId))
      .orderBy(desc(activities.createdAt));
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity;
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined> {
    const [updated] = await db.update(activities).set({ ...activity, updatedAt: new Date() }).where(eq(activities.id, id)).returning();
    return updated;
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
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
    const [dealsStats] = await db.select({
      total: count(),
      open: sql<number>`count(*) filter (where ${deals.status} = 'open')`,
      won: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
      totalValue: sql<string>`coalesce(sum(${deals.value}), 0)`,
    }).from(deals).where(eq(deals.organizationId, organizationId));

    const [contactsCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.organizationId, organizationId));
    const [companiesCount] = await db.select({ count: count() }).from(companies).where(eq(companies.organizationId, organizationId));
    const [pendingCount] = await db.select({ count: count() }).from(activities)
      .where(and(eq(activities.organizationId, organizationId), eq(activities.status, "pending")));
    const [unreadCount] = await db.select({ 
      count: sql<number>`count(*) filter (where ${conversations.unreadCount} > 0)` 
    }).from(conversations).where(eq(conversations.organizationId, organizationId));

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
    return await db.select().from(savedViews)
      .where(and(eq(savedViews.userId, userId), eq(savedViews.type, type)))
      .orderBy(savedViews.name);
  }

  async getSavedView(id: number): Promise<SavedView | undefined> {
    const [view] = await db.select().from(savedViews).where(eq(savedViews.id, id));
    return view;
  }

  async createSavedView(view: InsertSavedView): Promise<SavedView> {
    const [created] = await db.insert(savedViews).values(view).returning();
    return created;
  }

  async updateSavedView(id: number, userId: string, view: Partial<InsertSavedView>): Promise<SavedView | undefined> {
    const [updated] = await db.update(savedViews)
      .set({ ...view, updatedAt: new Date() })
      .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
      .returning();
    return updated;
  }

  async deleteSavedView(id: number, userId: string): Promise<void> {
    await db.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)));
  }

  async getEmailTemplates(organizationId: number): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates)
      .where(eq(emailTemplates.organizationId, organizationId))
      .orderBy(emailTemplates.name);
  }

  async getEmailTemplate(id: number, organizationId: number): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, organizationId)));
    return template;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [created] = await db.insert(emailTemplates).values(template).returning();
    return created;
  }

  async updateEmailTemplate(id: number, organizationId: number, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [updated] = await db.update(emailTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, organizationId)))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: number, organizationId: number): Promise<void> {
    await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, organizationId)));
  }

  async getAuditLogs(organizationId: number, limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByEntity(entityType: AuditLogEntityType, entityId: number): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
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
    const stages = await db.select().from(pipelineStages)
      .innerJoin(pipelines, eq(pipelineStages.pipelineId, pipelines.id))
      .where(eq(pipelines.organizationId, organizationId))
      .orderBy(pipelineStages.order);

    const dealsByStage = await db.select({
      stageName: sql<string>`coalesce(${pipelineStages.name}, 'Unassigned')`,
      count: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
    })
      .from(deals)
      .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
      .where(and(
        eq(deals.organizationId, organizationId),
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
        eq(deals.organizationId, organizationId),
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
        eq(deals.organizationId, organizationId),
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
        eq(deals.organizationId, organizationId),
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
        eq(activities.organizationId, organizationId),
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
        eq(deals.organizationId, organizationId),
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
    return await db.select().from(files)
      .where(and(eq(files.entityType, entityType), eq(files.entityId, entityId)))
      .orderBy(desc(files.createdAt));
  }

  async getFile(id: number): Promise<FileRecord | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async createFile(file: InsertFile): Promise<FileRecord> {
    const [created] = await db.insert(files).values(file).returning();
    return created;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async getLeadScore(entityType: LeadScoreEntityType, entityId: number): Promise<LeadScore | undefined> {
    const [score] = await db.select().from(leadScores)
      .where(and(eq(leadScores.entityType, entityType), eq(leadScores.entityId, entityId)))
      .orderBy(desc(leadScores.createdAt))
      .limit(1);
    return score;
  }

  async getLeadScores(organizationId: number): Promise<LeadScore[]> {
    return await db.select().from(leadScores)
      .where(eq(leadScores.organizationId, organizationId))
      .orderBy(desc(leadScores.createdAt));
  }

  async createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
    const [created] = await db.insert(leadScores).values(score).returning();
    return created;
  }

  async getContactScoringData(contactId: number): Promise<{
    activities: { totalActivities: number; completedActivities: number; pendingActivities: number; lastActivityDate: Date | null; activityTypes: Record<string, number> };
    conversations: { totalConversations: number; totalMessages: number; lastMessageDate: Date | null; channels: string[] };
    deals: { count: number; totalValue: number; wonDeals: number };
  }> {
    const contactActivities = await db.select().from(activities).where(eq(activities.contactId, contactId));
    const contactConversations = await db.select().from(conversations).where(eq(conversations.contactId, contactId));
    const contactDeals = await db.select().from(deals).where(eq(deals.contactId, contactId));

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
    const [dealRecord] = await db.select().from(deals).where(eq(deals.id, dealId));
    if (!dealRecord) {
      return {
        deal: null,
        activities: { totalActivities: 0, completedActivities: 0, pendingActivities: 0, lastActivityDate: null, activityTypes: {} },
        conversations: { totalConversations: 0, totalMessages: 0, lastMessageDate: null, channels: [] }
      };
    }

    const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, dealRecord.stageId));
    const allStages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, dealRecord.pipelineId));

    let contactName: string | null = null;
    let companyName: string | null = null;
    if (dealRecord.contactId) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, dealRecord.contactId));
      if (contact) contactName = `${contact.firstName} ${contact.lastName || ''}`.trim();
    }
    if (dealRecord.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, dealRecord.companyId));
      if (company) companyName = company.name;
    }

    const dealActivities = await db.select().from(activities).where(eq(activities.dealId, dealId));
    const dealConversations = await db.select().from(conversations).where(eq(conversations.dealId, dealId));

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
    return await db.select().from(calendarEvents)
      .where(and(
        eq(calendarEvents.organizationId, organizationId),
        gte(calendarEvents.startTime, startDate),
        lte(calendarEvents.endTime, endDate)
      ))
      .orderBy(calendarEvents.startTime);
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event;
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [created] = await db.insert(calendarEvents).values(event).returning();
    return created;
  }

  async updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [updated] = await db.update(calendarEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated;
  }

  async deleteCalendarEvent(id: number): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  async getChannelConfigs(organizationId: number): Promise<ChannelConfig[]> {
    return await db.select().from(channelConfigs)
      .where(eq(channelConfigs.organizationId, organizationId))
      .orderBy(desc(channelConfigs.createdAt));
  }

  async getChannelConfig(id: number): Promise<ChannelConfig | undefined> {
    const [config] = await db.select().from(channelConfigs).where(eq(channelConfigs.id, id));
    return config;
  }

  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    const [created] = await db.insert(channelConfigs).values(config).returning();
    return created;
  }

  async updateChannelConfig(id: number, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
    // Fetch existing config to merge nested JSONB objects (preserves secrets if not provided)
    const [existing] = await db.select().from(channelConfigs).where(eq(channelConfigs.id, id));
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

    const [updated] = await db.update(channelConfigs)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(channelConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteChannelConfig(id: number): Promise<void> {
    await db.delete(channelConfigs).where(eq(channelConfigs.id, id));
  }

  async updateChannelConfigLastSync(id: number): Promise<ChannelConfig | undefined> {
    const [updated] = await db.update(channelConfigs)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(channelConfigs.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
