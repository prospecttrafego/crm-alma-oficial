import {
  conversations,
  contacts,
  deals,
  messages,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { db } from "../db";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  lt,
  not,
  sql,
} from "drizzle-orm";
import {
  getTenantOrganizationId,
  normalizePagination,
  type PaginationParams,
  type PaginatedResult,
} from "./helpers";

export async function getConversations(_organizationId: number): Promise<Conversation[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(conversations)
    .where(eq(conversations.organizationId, tenantOrganizationId))
    .orderBy(desc(conversations.lastMessageAt));
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

export async function getMessages(
  conversationId: number,
  options?: { cursor?: number; limit?: number },
): Promise<{ messages: Message[]; nextCursor: number | null; hasMore: boolean }> {
  const tenantOrganizationId = await getTenantOrganizationId();
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

  const result = await db
    .select()
    .from(messages)
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

/**
 * Check if a message with the given externalId already exists (for idempotency)
 */
export async function getMessageByExternalId(externalId: string): Promise<Message | undefined> {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.externalId, externalId))
    .limit(1);
  return message;
}

export async function createMessage(message: InsertMessage): Promise<Message> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, message.conversationId), eq(conversations.organizationId, tenantOrganizationId)))
    .limit(1);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Deduplication: if externalId is provided, check if message already exists
  // This prevents duplicate messages on reconnection or retry scenarios
  if (message.externalId) {
    const existing = await getMessageByExternalId(message.externalId);
    if (existing) {
      // Return existing message instead of creating duplicate
      return existing;
    }
  }

  // If message is from a user, pre-populate readBy with the sender
  // This prevents the sender's own message from counting as unread for them
  const messageData = { ...message };
  if (message.senderType === "user" && message.senderId) {
    messageData.readBy = [message.senderId];
  }

  const [created] = await db.insert(messages).values(messageData).returning();

  // Only increment unreadCount for messages from contacts (not from users)
  // This ensures user-sent messages don't inflate the unread counter
  const shouldIncrementUnread = message.senderType === "contact";

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      ...(shouldIncrementUnread ? { unreadCount: sql`${conversations.unreadCount} + 1` } : {}),
    })
    .where(and(eq(conversations.id, message.conversationId), eq(conversations.organizationId, tenantOrganizationId)));
  return created;
}

export async function markMessagesAsRead(conversationId: number, userId: string): Promise<number> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, tenantOrganizationId)))
    .limit(1);

  if (!conversation) return 0;

  // Get unread messages that this user hasn't read yet
  const unreadMessages = await db
    .select({ id: messages.id, readBy: messages.readBy })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        not(sql`coalesce(${messages.readBy}, '{}'::text[]) @> ARRAY[${userId}]::text[]`),
      ),
    );

  if (unreadMessages.length === 0) return 0;

  // Update each message to add user to readBy array
  for (const msg of unreadMessages) {
    const currentReadBy = msg.readBy || [];
    if (!currentReadBy.includes(userId)) {
      await db
        .update(messages)
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
 * Delete all messages in a conversation
 */
export async function deleteMessagesByConversation(conversationId: number): Promise<number> {
  const result = await db
    .delete(messages)
    .where(eq(messages.conversationId, conversationId))
    .returning({ id: messages.id });
  return result.length;
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
