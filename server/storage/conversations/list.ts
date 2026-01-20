import {
  conversations,
  contacts,
  deals,
  companies,
  users,
  type Conversation,
  type InsertConversation,
} from "@shared/schema";
import type { ConversationWithRelations } from "@shared/types";
import { db } from "../../db";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getTenantOrganizationId,
  normalizePagination,
  type PaginationParams,
  type PaginatedResult,
} from "../helpers";
import { toSafeUser } from "../../response";

const contactCompany = alias(companies, "contactCompany");
const dealCompany = alias(companies, "dealCompany");

type ConversationRow = {
  conversation: Conversation;
  contact: typeof contacts.$inferSelect | null;
  contactCompany: typeof companies.$inferSelect | null;
  deal: typeof deals.$inferSelect | null;
  dealCompany: typeof companies.$inferSelect | null;
  assignedUser: typeof users.$inferSelect | null;
};

function mapConversationRow(row: ConversationRow): ConversationWithRelations {
  const contactCompanyRecord = row.contactCompany?.id ? row.contactCompany : null;
  const dealCompanyRecord = row.dealCompany?.id ? row.dealCompany : null;

  const contact = row.contact?.id
    ? { ...row.contact, company: contactCompanyRecord }
    : null;

  const deal = row.deal?.id ? row.deal : null;
  const company = contactCompanyRecord || dealCompanyRecord || null;
  const assignedTo = row.assignedUser?.id ? toSafeUser(row.assignedUser) : null;
  const rawStatus = row.conversation.status;
  const status =
    rawStatus === "open" || rawStatus === "closed" || rawStatus === "pending"
      ? rawStatus
      : null;

  return {
    ...row.conversation,
    status,
    contact,
    deal,
    company,
    assignedTo,
  };
}

async function listConversationsWithRelations(whereCondition: any, options?: { limit?: number; offset?: number }) {
  const assignedUser = alias(users, "assignedUser");

  const query = db
    .select({
      conversation: conversations,
      contact: contacts,
      contactCompany,
      deal: deals,
      dealCompany,
      assignedUser: assignedUser,
    })
    .from(conversations)
    .leftJoin(contacts, eq(conversations.contactId, contacts.id))
    .leftJoin(contactCompany, eq(contacts.companyId, contactCompany.id))
    .leftJoin(deals, eq(conversations.dealId, deals.id))
    .leftJoin(dealCompany, eq(deals.companyId, dealCompany.id))
    .leftJoin(assignedUser, eq(conversations.assignedToId, assignedUser.id))
    .where(whereCondition)
    .orderBy(desc(conversations.lastMessageAt));

  if (typeof options?.limit === "number" && typeof options?.offset === "number") {
    return query.limit(options.limit).offset(options.offset);
  }
  if (typeof options?.limit === "number") {
    return query.limit(options.limit);
  }
  if (typeof options?.offset === "number") {
    return query.offset(options.offset);
  }
  return query;
}

export async function getConversations(_organizationId: number): Promise<Conversation[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const rows = await listConversationsWithRelations(
    eq(conversations.organizationId, tenantOrganizationId)
  );
  return rows.map(mapConversationRow);
}

export async function getConversationsPaginated(
  _organizationId: number,
  params: PaginationParams & { status?: string; channel?: string; assignedToId?: string },
): Promise<PaginatedResult<Conversation>> {
  const tenantOrganizationId = await getTenantOrganizationId();
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
    conditions.push(
      eq(conversations.channel, params.channel as "email" | "whatsapp" | "sms" | "internal" | "phone"),
    );
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

  const rows = await listConversationsWithRelations(whereCondition, { limit, offset });
  const data = rows.map(mapConversationRow);

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

export async function getConversation(id: number): Promise<Conversation | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.organizationId, tenantOrganizationId)));
  return conversation;
}

/**
 * Find conversation by contact ID and channel (optimized for WhatsApp handler)
 */
export async function getConversationByContactAndChannel(
  contactId: number,
  channel: string,
  _organizationId: number,
): Promise<Conversation | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, tenantOrganizationId),
        eq(conversations.contactId, contactId),
        eq(conversations.channel, channel as any),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  return conversation;
}

export async function createConversation(
  conversation: InsertConversation,
): Promise<Conversation> {
  const tenantOrganizationId = await getTenantOrganizationId();

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

export async function updateConversation(
  id: number,
  conversation: Partial<InsertConversation>,
): Promise<Conversation | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
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

/**
 * Get all conversations for a contact
 */
export async function getConversationsByContact(contactId: number): Promise<Conversation[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.contactId, contactId), eq(conversations.organizationId, tenantOrganizationId)));
}

/**
 * Delete all conversations for a contact
 */
export async function deleteConversationsByContact(contactId: number): Promise<number> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const result = await db
    .delete(conversations)
    .where(and(eq(conversations.contactId, contactId), eq(conversations.organizationId, tenantOrganizationId)))
    .returning({ id: conversations.id });
  return result.length;
}
