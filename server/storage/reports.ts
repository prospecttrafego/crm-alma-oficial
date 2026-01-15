import {
  activities,
  deals,
  pipelineStages,
  users,
} from "@shared/schema";
import { db, pool } from "../db";
import { and, count, eq, sql } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

/**
 * Get dashboard statistics in a single optimized query using CTEs
 * Consolidates 6 separate queries into 1 round-trip to the database
 */
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

  // Calculate month start for new contacts
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Single query using CTEs for all dashboard stats
  const result = await pool.query<{
    total_deals: string;
    open_deals: string;
    won_deals: string;
    lost_deals: string;
    total_value: string;
    contacts_count: string;
    companies_count: string;
    new_contacts: string;
    pending_activities: string;
    open_conversations: string;
    unread_conversations: string;
  }>(`
    WITH deal_stats AS (
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE status = 'open') AS open,
        count(*) FILTER (WHERE status = 'won') AS won,
        count(*) FILTER (WHERE status = 'lost') AS lost,
        COALESCE(sum(value), 0) AS total_value
      FROM deals
      WHERE organization_id = $1
    ),
    contact_stats AS (
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE created_at >= $2) AS new_this_month
      FROM contacts
      WHERE organization_id = $1
    ),
    company_stats AS (
      SELECT count(*) AS total
      FROM companies
      WHERE organization_id = $1
    ),
    activity_stats AS (
      SELECT count(*) AS pending
      FROM activities
      WHERE organization_id = $1 AND status = 'pending'
    ),
    conversation_stats AS (
      SELECT
        count(*) FILTER (WHERE status != 'closed') AS open,
        count(*) FILTER (WHERE unread_count > 0) AS unread
      FROM conversations
      WHERE organization_id = $1
    )
    SELECT
      d.total AS total_deals,
      d.open AS open_deals,
      d.won AS won_deals,
      d.lost AS lost_deals,
      d.total_value,
      c.total AS contacts_count,
      co.total AS companies_count,
      c.new_this_month AS new_contacts,
      a.pending AS pending_activities,
      cv.open AS open_conversations,
      cv.unread AS unread_conversations
    FROM deal_stats d, contact_stats c, company_stats co, activity_stats a, conversation_stats cv
  `, [tenantOrganizationId, monthStart]);

  const row = result.rows[0];

  return {
    totalDeals: Number(row?.total_deals) || 0,
    openDeals: Number(row?.open_deals) || 0,
    wonDeals: Number(row?.won_deals) || 0,
    lostDeals: Number(row?.lost_deals) || 0,
    totalValue: Number(row?.total_value) || 0,
    contacts: Number(row?.contacts_count) || 0,
    companies: Number(row?.companies_count) || 0,
    newContacts: Number(row?.new_contacts) || 0,
    pendingActivities: Number(row?.pending_activities) || 0,
    openConversations: Number(row?.open_conversations) || 0,
    unreadConversations: Number(row?.unread_conversations) || 0,
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
