import {
  activities,
  contacts,
  companies,
  conversations,
  deals,
  pipelineStages,
  users,
} from "@shared/schema";
import { db } from "../db";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getDashboardStats(_organizationId: number): Promise<{
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
}> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [dealsStats] = await db
    .select({
      total: count(),
      open: sql<number>`count(*) filter (where ${deals.status} = 'open')`,
      won: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
      lost: sql<number>`count(*) filter (where ${deals.status} = 'lost')`,
      totalValue: sql<string>`coalesce(sum(${deals.value}), 0)`,
    })
    .from(deals)
    .where(eq(deals.organizationId, tenantOrganizationId));

  const [contactsCount] = await db
    .select({ count: count() })
    .from(contacts)
    .where(eq(contacts.organizationId, tenantOrganizationId));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [newContactsCount] = await db
    .select({ count: count() })
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, tenantOrganizationId),
        gte(contacts.createdAt, monthStart),
      ),
    );
  const [companiesCount] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.organizationId, tenantOrganizationId));
  const [pendingCount] = await db
    .select({ count: count() })
    .from(activities)
    .where(and(eq(activities.organizationId, tenantOrganizationId), eq(activities.status, "pending")));
  const [conversationStats] = await db
    .select({
      open: sql<number>`count(*) filter (where ${conversations.status} != 'closed')`,
      unread: sql<number>`count(*) filter (where ${conversations.unreadCount} > 0)`,
    })
    .from(conversations)
    .where(eq(conversations.organizationId, tenantOrganizationId));

  return {
    totalDeals: Number(dealsStats?.total) || 0,
    openDeals: Number(dealsStats?.open) || 0,
    wonDeals: Number(dealsStats?.won) || 0,
    lostDeals: Number(dealsStats?.lost) || 0,
    totalValue: Number(dealsStats?.totalValue) || 0,
    contacts: contactsCount?.count || 0,
    companies: companiesCount?.count || 0,
    newContacts: newContactsCount?.count || 0,
    pendingActivities: pendingCount?.count || 0,
    openConversations: Number(conversationStats?.open) || 0,
    unreadConversations: Number(conversationStats?.unread) || 0,
  };
}

export async function getReportData(
  _organizationId: number,
  startDate: Date,
  endDate: Date,
): Promise<{
  dealsByStage: { stage: string; count: number; value: string }[];
  dealsOverTime: { date: string; count: number; value: string }[];
  conversionFunnel: { stage: string; deals: number; value: string; order: number }[];
  teamPerformance: { userId: string; name: string; deals: number; value: string; wonDeals: number }[];
  activitySummary: { type: string; count: number }[];
  wonLostByMonth: { month: string; won: number; lost: number; wonValue: string; lostValue: string }[];
}> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const dealsByStage = await db
    .select({
      stageName: sql<string>`coalesce(${pipelineStages.name}, 'Unassigned')`,
      count: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
    })
    .from(deals)
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(
      and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`,
      ),
    )
    .groupBy(pipelineStages.name);

  const dealsOverTime = await db
    .select({
      date: sql<string>`date_trunc('day', ${deals.createdAt})::date::text`,
      count: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)`,
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`,
      ),
    )
    .groupBy(sql`date_trunc('day', ${deals.createdAt})`)
    .orderBy(sql`date_trunc('day', ${deals.createdAt})`);

  const conversionFunnel = await db
    .select({
      stage: sql<string>`coalesce(${pipelineStages.name}, 'Unassigned')`,
      deals: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
      order: sql<number>`coalesce(${pipelineStages.order}, 999)`,
    })
    .from(deals)
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(
      and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`,
      ),
    )
    .groupBy(pipelineStages.name, pipelineStages.order)
    .orderBy(sql`coalesce(${pipelineStages.order}, 999)`);

  const teamPerformance = await db
    .select({
      userId: sql<string>`coalesce(${users.id}, 'unassigned')`,
      firstName: users.firstName,
      lastName: users.lastName,
      deals: count(),
      value: sql<string>`coalesce(sum(${deals.value}), 0)::numeric`,
      wonDeals: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
    })
    .from(deals)
    .leftJoin(users, eq(deals.ownerId, users.id))
    .where(
      and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.createdAt} >= ${startDate}`,
        sql`${deals.createdAt} <= ${endDate}`,
      ),
    )
    .groupBy(users.id, users.firstName, users.lastName);

  const activitySummary = await db
    .select({
      type: activities.type,
      count: count(),
    })
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, tenantOrganizationId),
        sql`${activities.createdAt} >= ${startDate}`,
        sql`${activities.createdAt} <= ${endDate}`,
      ),
    )
    .groupBy(activities.type);

  const wonLostByMonth = await db
    .select({
      month: sql<string>`to_char(${deals.updatedAt}, 'YYYY-MM')`,
      won: sql<number>`count(*) filter (where ${deals.status} = 'won')`,
      lost: sql<number>`count(*) filter (where ${deals.status} = 'lost')`,
      wonValue: sql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won'), 0)`,
      lostValue: sql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'lost'), 0)`,
    })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, tenantOrganizationId),
        sql`${deals.updatedAt} >= ${startDate}`,
        sql`${deals.updatedAt} <= ${endDate}`,
      ),
    )
    .groupBy(sql`to_char(${deals.updatedAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${deals.updatedAt}, 'YYYY-MM')`);

  return {
    dealsByStage: dealsByStage.map((d) => ({
      stage: d.stageName,
      count: Number(d.count),
      value: String(d.value),
    })),
    dealsOverTime: dealsOverTime.map((d) => ({
      date: d.date,
      count: Number(d.count),
      value: String(d.value),
    })),
    conversionFunnel: conversionFunnel.map((d) => ({
      stage: d.stage,
      deals: Number(d.deals),
      value: String(d.value),
      order: d.order,
    })),
    teamPerformance: teamPerformance.map((d) => ({
      userId: d.userId,
      name: `${d.firstName || ""} ${d.lastName || ""}`.trim() || "Unknown",
      deals: Number(d.deals),
      value: String(d.value),
      wonDeals: Number(d.wonDeals),
    })),
    activitySummary: activitySummary.map((d) => ({
      type: d.type,
      count: Number(d.count),
    })),
    wonLostByMonth: wonLostByMonth.map((d) => ({
      month: d.month,
      won: Number(d.won),
      lost: Number(d.lost),
      wonValue: String(d.wonValue),
      lostValue: String(d.lostValue),
    })),
  };
}
