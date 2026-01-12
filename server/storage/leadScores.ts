import {
  leadScores,
  contacts,
  activities,
  conversations,
  deals,
  messages,
  pipelineStages,
  pipelines,
  companies,
  type LeadScore,
  type InsertLeadScore,
  type LeadScoreEntityType,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getLeadScore(
  entityType: LeadScoreEntityType,
  entityId: number,
): Promise<LeadScore | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
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

export async function getLeadScores(_organizationId: number): Promise<LeadScore[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(leadScores)
    .where(eq(leadScores.organizationId, tenantOrganizationId))
    .orderBy(desc(leadScores.createdAt));
}

export async function createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(leadScores)
    .values({ ...score, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function getContactScoringData(contactId: number): Promise<{
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
}> {
  const tenantOrganizationId = await getTenantOrganizationId();
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
    .where(and(eq(conversations.contactId, contactId), eq(conversations.organizationId, tenantOrganizationId)));
  const contactDeals = await db
    .select()
    .from(deals)
    .where(and(eq(deals.contactId, contactId), eq(deals.organizationId, tenantOrganizationId)));

  const activityTypes: Record<string, number> = {};
  let lastActivityDate: Date | null = null;
  let completedActivities = 0;
  let pendingActivities = 0;

  contactActivities.forEach((a) => {
    activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
    if (a.status === "completed") completedActivities++;
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
    convMessages.forEach((m) => {
      if (m.createdAt && (!lastMessageDate || m.createdAt > lastMessageDate)) {
        lastMessageDate = m.createdAt;
      }
    });
  }

  let totalValue = 0;
  let wonDeals = 0;
  contactDeals.forEach((d) => {
    if (d.value) totalValue += parseFloat(d.value);
    if (d.status === "won") wonDeals++;
  });

  return {
    activities: {
      totalActivities: contactActivities.length,
      completedActivities,
      pendingActivities,
      lastActivityDate,
      activityTypes,
    },
    conversations: {
      totalConversations: contactConversations.length,
      totalMessages,
      lastMessageDate,
      channels: Array.from(channels),
    },
    deals: {
      count: contactDeals.length,
      totalValue,
      wonDeals,
    },
  };
}

export async function getDealScoringData(dealId: number): Promise<{
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
}> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [dealRecord] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, tenantOrganizationId)));
  if (!dealRecord) {
    return {
      deal: null,
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
    };
  }

  const [stage] = await db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.id, dealRecord.stageId), eq(pipelineStages.pipelineId, dealRecord.pipelineId)));
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
    if (contact) contactName = `${contact.firstName} ${contact.lastName || ""}`.trim();
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

  dealActivities.forEach((a) => {
    activityTypes[a.type] = (activityTypes[a.type] || 0) + 1;
    if (a.status === "completed") completedActivities++;
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
    convMessages.forEach((m) => {
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
      stageName: stage?.name || "Unknown",
      stageOrder: stage?.order || 0,
      totalStages: allStages.length,
      probability: dealRecord.probability,
      status: dealRecord.status,
      contactName,
      companyName,
    },
    activities: {
      totalActivities: dealActivities.length,
      completedActivities,
      pendingActivities,
      lastActivityDate,
      activityTypes,
    },
    conversations: {
      totalConversations: dealConversations.length,
      totalMessages,
      lastMessageDate,
      channels: Array.from(channels),
    },
  };
}
