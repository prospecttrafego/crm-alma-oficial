import {
  conversations,
  messages,
  users,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { db } from "../../db";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, lt, not, sql } from "drizzle-orm";
import { getTenantOrganizationId } from "../helpers";
import type { MessageWithSender, QuotedMessage } from "@shared/apiSchemas";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as any).code === "23505";
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
  const tenantOrganizationId = await getTenantOrganizationId();
  const [result] = await db
    .select({ message: messages })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.externalId, externalId), eq(conversations.organizationId, tenantOrganizationId)))
    .limit(1);
  return result?.message;
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

  // If message is from a user, pre-populate readBy with the sender
  // This prevents the sender's own message from counting as unread for them
  const messageData = { ...message };
  if (message.senderType === "user" && message.senderId) {
    messageData.readBy = [message.senderId];
  }

  let created: Message | undefined;

  try {
    const result = await db.insert(messages).values(messageData).returning();
    created = result[0];
  } catch (error) {
    if (message.externalId && isUniqueViolation(error)) {
      const existing = await getMessageByExternalId(message.externalId);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }

  if (!created) {
    throw new Error("Failed to create message");
  }

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

  // Batch update: add userId to readBy array for all messages that don't already have it
  // Uses array_append for efficient single-query update instead of N+1 queries
  const result = await db
    .update(messages)
    .set({
      readBy: sql`array_append(coalesce(${messages.readBy}, '{}'::text[]), ${userId}::text)`,
    })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        not(sql`coalesce(${messages.readBy}, '{}'::text[]) @> ARRAY[${userId}]::text[]`),
      ),
    )
    .returning({ id: messages.id });

  const updatedCount = result.length;

  if (updatedCount > 0) {
    // Reset unread count on conversation
    await db
      .update(conversations)
      .set({ unreadCount: 0 })
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, tenantOrganizationId)));
  }

  return updatedCount;
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
 * Only allowed within 15-minute window and by the original sender
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
