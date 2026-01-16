import {
  conversations,
  contacts,
  deals,
  messages,
  users,
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
import { alias } from "drizzle-orm/pg-core";
import {
  getTenantOrganizationId,
  normalizePagination,
  type PaginationParams,
  type PaginatedResult,
} from "./helpers";
import type { MessageWithSender, QuotedMessage } from "@shared/apiSchemas";

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
): Promise<{ messages: MessageWithSender[]; nextCursor: number | null; hasMore: boolean }> {
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

  // Alias for self-join to get replied-to message
  const replyToMessage = alias(messages, "replyToMessage");
  // Alias for user who sent the reply-to message
  const replyToSender = alias(users, "replyToSender");

  // Build conditions
  const conditions = [eq(messages.conversationId, conversationId)];

  if (cursor) {
    // Cursor-based: buscar mensagens com ID menor que o cursor (mais antigas)
    conditions.push(lt(messages.id, cursor));
  }

  // Query with joins for sender and reply-to message
  const result = await db
    .select({
      // Main message fields
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderType: messages.senderType,
      content: messages.content,
      contentType: messages.contentType,
      isInternal: messages.isInternal,
      attachments: messages.attachments,
      metadata: messages.metadata,
      mentions: messages.mentions,
      readBy: messages.readBy,
      externalId: messages.externalId,
      replyToId: messages.replyToId,
      createdAt: messages.createdAt,
      editedAt: messages.editedAt,
      deletedAt: messages.deletedAt,
      originalContent: messages.originalContent,
      // Sender user fields
      senderFirstName: users.firstName,
      senderLastName: users.lastName,
      senderEmail: users.email,
      senderRole: users.role,
      senderProfileImageUrl: users.profileImageUrl,
      senderOrganizationId: users.organizationId,
      senderCreatedAt: users.createdAt,
      senderUpdatedAt: users.updatedAt,
      senderPreferences: users.preferences,
      // Reply-to message fields
      replyToMessageId: replyToMessage.id,
      replyToContent: replyToMessage.content,
      replyToContentType: replyToMessage.contentType,
      replyToSenderType: replyToMessage.senderType,
      replyToSenderId: replyToMessage.senderId,
      replyToCreatedAt: replyToMessage.createdAt,
      // Reply-to sender name
      replyToSenderFirstName: replyToSender.firstName,
      replyToSenderLastName: replyToSender.lastName,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .leftJoin(replyToMessage, eq(messages.replyToId, replyToMessage.id))
    .leftJoin(replyToSender, eq(replyToMessage.senderId, replyToSender.id))
    .where(and(...conditions))
    .orderBy(desc(messages.id))
    .limit(limit + 1);

  // Verificar se ha mais mensagens
  const hasMore = result.length > limit;
  const rawMessageList = hasMore ? result.slice(0, limit) : result;

  // Transform to MessageWithSender format
  const messageList: MessageWithSender[] = rawMessageList.map((row) => {
    // Build sender object if senderId exists and is a user
    const sender = row.senderId && row.senderEmail ? {
      id: row.senderId,
      email: row.senderEmail,
      firstName: row.senderFirstName,
      lastName: row.senderLastName,
      role: row.senderRole,
      profileImageUrl: row.senderProfileImageUrl,
      organizationId: row.senderOrganizationId,
      createdAt: row.senderCreatedAt,
      updatedAt: row.senderUpdatedAt,
      preferences: row.senderPreferences,
    } : null;

    // Build replyTo object if replyToId exists
    let replyTo: QuotedMessage | null = null;
    if (row.replyToId && row.replyToMessageId) {
      // Build sender name for quoted message
      let senderName: string | null = null;
      if (row.replyToSenderType === "user" && (row.replyToSenderFirstName || row.replyToSenderLastName)) {
        senderName = [row.replyToSenderFirstName, row.replyToSenderLastName].filter(Boolean).join(" ");
      } else if (row.replyToSenderType === "contact") {
        senderName = "Contact"; // Could be enhanced to fetch contact name
      } else if (row.replyToSenderType === "system") {
        senderName = "System";
      }

      replyTo = {
        id: row.replyToMessageId,
        content: row.replyToContent || "",
        contentType: row.replyToContentType,
        senderType: row.replyToSenderType,
        senderId: row.replyToSenderId,
        senderName,
        createdAt: row.replyToCreatedAt,
      };
    }

    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      senderType: row.senderType,
      content: row.content,
      contentType: row.contentType,
      isInternal: row.isInternal,
      attachments: row.attachments,
      metadata: row.metadata,
      mentions: row.mentions,
      readBy: row.readBy,
      externalId: row.externalId,
      replyToId: row.replyToId,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      deletedAt: row.deletedAt,
      originalContent: row.originalContent,
      sender,
      replyTo,
    };
  });

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

/**
 * Search result type for message search
 */
export interface MessageSearchResult {
  id: number;
  conversationId: number;
  content: string;
  createdAt: Date | null;
  senderId: string | null;
  senderType: string | null;
  senderName: string | null;
  conversationSubject: string | null;
  rank: number;
}

/**
 * Search messages by content using PostgreSQL full-text search
 * Returns messages matching the query with relevance ranking
 */
export async function searchMessages(
  query: string,
  options?: {
    conversationId?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ results: MessageSearchResult[]; total: number }> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // Sanitize query for PostgreSQL full-text search
  const sanitizedQuery = query.trim().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean).join(" & ");

  if (!sanitizedQuery) {
    return { results: [], total: 0 };
  }

  // Build conditions
  const conditions = [eq(conversations.organizationId, tenantOrganizationId)];

  if (options?.conversationId) {
    conditions.push(eq(messages.conversationId, options.conversationId));
  }

  // Use raw SQL for full-text search with ts_rank
  const searchCondition = sql`to_tsvector('portuguese', coalesce(${messages.content}, '')) @@ plainto_tsquery('portuguese', ${sanitizedQuery})`;

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(...conditions, searchCondition));

  const total = Number(countResult?.count || 0);

  // Get search results with ranking
  const results = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      content: messages.content,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      senderType: messages.senderType,
      senderName: sql<string | null>`
        CASE
          WHEN ${messages.senderType} = 'user' THEN COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})
          WHEN ${messages.senderType} = 'contact' THEN 'Contact'
          ELSE 'System'
        END
      `,
      conversationSubject: conversations.subject,
      rank: sql<number>`ts_rank(to_tsvector('portuguese', coalesce(${messages.content}, '')), plainto_tsquery('portuguese', ${sanitizedQuery}))`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(...conditions, searchCondition))
    .orderBy(sql`ts_rank(to_tsvector('portuguese', coalesce(${messages.content}, '')), plainto_tsquery('portuguese', ${sanitizedQuery})) DESC`)
    .limit(limit)
    .offset(offset);

  return { results, total };
}

/** Edit window in milliseconds (15 minutes) */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Check if a message can still be edited (within 15-minute window)
 */
export function canEditMessage(message: { createdAt: Date | null }): boolean {
  if (!message.createdAt) return false;
  const createdAt = new Date(message.createdAt).getTime();
  const now = Date.now();
  return now - createdAt <= EDIT_WINDOW_MS;
}

/**
 * Get a single message by ID
 */
export async function getMessage(id: number): Promise<Message | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();

  // Join with conversations to validate organization
  const [result] = await db
    .select({ message: messages })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(
      eq(messages.id, id),
      eq(conversations.organizationId, tenantOrganizationId)
    ))
    .limit(1);

  return result?.message;
}

/**
 * Update a message's content
 * Only allowed within 15-minute edit window and by the original sender
 * Stores original content and sets editedAt timestamp
 */
export async function updateMessage(
  id: number,
  senderId: string,
  newContent: string
): Promise<Message | undefined> {
  // Get the existing message
  const [existing] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);

  if (!existing) return undefined;

  // Check if user is the sender
  if (existing.senderId !== senderId) {
    throw new Error("You can only edit your own messages");
  }

  // Check if message is already deleted
  if (existing.deletedAt) {
    throw new Error("Cannot edit a deleted message");
  }

  // Check edit window
  if (!canEditMessage(existing)) {
    throw new Error("Message can no longer be edited (15-minute window expired)");
  }

  // Store original content only on first edit
  const originalContent = existing.originalContent ?? existing.content;

  const [updated] = await db
    .update(messages)
    .set({
      content: newContent,
      originalContent,
      editedAt: new Date(),
    })
    .where(eq(messages.id, id))
    .returning();

  return updated;
}

/**
 * Soft delete a message
 * Only allowed by the original sender
 * Sets deletedAt timestamp instead of actually deleting
 */
export async function softDeleteMessage(
  id: number,
  senderId: string
): Promise<Message | undefined> {
  // Get the existing message
  const [existing] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);

  if (!existing) return undefined;

  // Check if user is the sender
  if (existing.senderId !== senderId) {
    throw new Error("You can only delete your own messages");
  }

  // Check if already deleted
  if (existing.deletedAt) {
    return existing; // Already deleted, return as-is
  }

  const [deleted] = await db
    .update(messages)
    .set({
      deletedAt: new Date(),
    })
    .where(eq(messages.id, id))
    .returning();

  return deleted;
}
