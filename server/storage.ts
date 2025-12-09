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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";

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
  getPipelineStages(pipelineId: number): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  
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
}

export const storage = new DatabaseStorage();
