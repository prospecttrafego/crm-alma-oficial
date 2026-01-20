import type { Express } from "express";
import { z } from "zod";
import type { NotificationType as PushNotificationType } from "../../integrations/firebase/notifications";
import {
  createMessageSchema,
  updateMessageSchema,
  idParamSchema,
} from "../../validation";
import {
  isAuthenticated,
  validateBody,
  validateParams,
  validateQuery,
  asyncHandler,
  getCurrentUser,
} from "../../middleware";
import { sendSuccess, sendNotFound, sendForbidden, sendError, ErrorCodes } from "../../response";
import { storage } from "../../storage";
import { broadcast, broadcastToConversation, broadcastToUser } from "../../ws/index";
import { logger } from "../../logger";
import { messagesQuerySchema } from "./schemas";

/**
 * Extract mentioned user IDs from message content
 * Format: @[Name](userId)
 */
function extractMentions(content: string | null): string[] {
  if (!content) return [];
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  // Remove duplicates using filter
  return mentions.filter((id, index) => mentions.indexOf(id) === index);
}

async function resolveMentionedUserIds(content: string | null, senderId: string): Promise<string[]> {
  const uuidSchema = z.string().uuid();
  const mentionedUserIds: string[] = [];
  for (const rawId of extractMentions(content)) {
    if (!uuidSchema.safeParse(rawId).success) continue;
    if (rawId === senderId) continue;
    const mentionedUser = await storage.getUser(rawId);
    if (!mentionedUser) continue;
    mentionedUserIds.push(rawId);
  }
  return mentionedUserIds;
}

async function sendPushIfOffline(
  userId: string,
  type: PushNotificationType,
  payload: Record<string, unknown>
) {
  try {
    const { isUserOnline } = await import("../../redis");
    const isOnline = await isUserOnline(userId);

    if (!isOnline) {
      const { sendNotificationToUser, isFcmAvailable } = await import(
        "../../integrations/firebase/notifications"
      );

      if (isFcmAvailable()) {
        await sendNotificationToUser(
          userId,
          type,
          payload,
          {
            getPushTokens: storage.getPushTokensForUser.bind(storage),
            deletePushToken: storage.deletePushToken.bind(storage),
          }
        );
      }
    }
  } catch (pushError) {
    logger.error("[FCM] Error sending push notification:", { error: pushError });
  }
}

async function notifyMentionedUsers(params: {
  conversationId: number;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  messagePreview: string;
  mentionedUserIds: string[];
}) {
  const { conversationId, senderName, senderAvatar, messagePreview, mentionedUserIds } = params;

  for (const mentionedUserId of mentionedUserIds) {
    await storage.createNotification({
      userId: mentionedUserId,
      type: "mention",
      title: "You were mentioned",
      message: `${senderName} mentioned you in a message`,
      entityType: "conversation",
      entityId: conversationId,
    });
    // Enrich notification payload with unread count (non-blocking on failure)
    const unreadCount = await storage.getUnreadNotificationCount(mentionedUserId).catch(() => undefined);
    broadcastToUser(mentionedUserId, "notification:new", { unreadCount });

    await sendPushIfOffline(mentionedUserId, "mention", {
      senderName,
      preview: messagePreview,
      conversationId,
      senderAvatar,
    });
  }
}

async function notifyAssignedUser(params: {
  conversationId: number;
  assignedToId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  messagePreview: string;
  subject: string | null;
}) {
  const { conversationId, assignedToId, senderId, senderName, senderAvatar, messagePreview, subject } = params;

  if (assignedToId === senderId) return;

  await storage.createNotification({
    userId: assignedToId,
    type: "new_message",
    title: "New Message",
    message: `New message in conversation: ${subject || "No subject"}`,
    entityType: "conversation",
    entityId: conversationId,
  });
  // Enrich notification payload with unread count (non-blocking on failure)
  const unreadCount = await storage.getUnreadNotificationCount(assignedToId).catch(() => undefined);
  broadcastToUser(assignedToId, "notification:new", { unreadCount });

  await sendPushIfOffline(assignedToId, "message:new", {
    senderName,
    preview: messagePreview,
    conversationId,
    senderAvatar,
  });
}

export function registerMessageRoutes(app: Express) {
  // GET /api/conversations/:id/messages - Listar mensagens da conversa
  app.get(
    "/api/conversations/:id/messages",
    isAuthenticated,
    validateParams(idParamSchema),
    validateQuery(messagesQuerySchema),
    asyncHandler(async (req, res) => {
      const { id: conversationId } = req.validatedParams;
      const { cursor, limit } = req.validatedQuery;

      const result = await storage.getMessages(conversationId, { cursor, limit });
      sendSuccess(res, result);
    }),
  );

  // POST /api/conversations/:id/messages - Criar mensagem na conversa
  app.post(
    "/api/conversations/:id/messages",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(createMessageSchema),
    asyncHandler(async (req, res) => {
      const { id: conversationId } = req.validatedParams;
      const senderId = getCurrentUser(req)!.id;

      // Extract mentioned users before creating message (validate UUID + existence)
      const mentionedUserIds = await resolveMentionedUserIds(req.validatedBody.content, senderId);

      const message = await storage.createMessage({
        ...req.validatedBody,
        conversationId,
        senderId,
        senderType: "user",
        // Store mentions in the message for reference
        mentions: mentionedUserIds.length > 0 ? mentionedUserIds : null,
      });

      // Broadcast direcionado para usuarios inscritos na conversa
      broadcastToConversation(conversationId, "message:created", message);

      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        broadcast("conversation:updated", {
          conversationId: conversation.id,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCount,
        });
      }

      const sender = await storage.getUser(senderId);
      const senderName = sender
        ? [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.email || "User"
        : "User";
      const messagePreview = message.content?.substring(0, 100) || "New message";

      // Create notifications for mentioned users
      if (mentionedUserIds.length > 0) {
        await notifyMentionedUsers({
          conversationId,
          senderId,
          senderName,
          senderAvatar: sender?.profileImageUrl,
          messagePreview,
          mentionedUserIds,
        });
      }

      // Create notification for assigned user if not the sender (and not already notified via mention)
      if (conversation?.assignedToId && !mentionedUserIds.includes(conversation.assignedToId)) {
        await notifyAssignedUser({
          conversationId,
          assignedToId: conversation.assignedToId,
          senderId,
          senderName,
          senderAvatar: sender?.profileImageUrl,
          messagePreview,
          subject: conversation.subject,
        });
      }

      sendSuccess(res, message, 201);
    }),
  );

  // POST /api/conversations/:id/read - Marcar mensagens como lidas
  app.post(
    "/api/conversations/:id/read",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id: conversationId } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      const count = await storage.markMessagesAsRead(conversationId, userId);

      // conversation:updated already broadcasts unreadCount - no need for separate message:read event
      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        broadcast("conversation:updated", {
          conversationId: conversation.id,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCount,
        });
      }

      sendSuccess(res, { success: true, count });
    }),
  );

  // PATCH /api/messages/:id - Editar mensagem
  app.patch(
    "/api/messages/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    validateBody(updateMessageSchema),
    asyncHandler(async (req, res) => {
      const { id: messageId } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;
      const { content } = req.validatedBody;

      // Get message to find conversationId for broadcast
      const existingMessage = await storage.getMessage(messageId);
      if (!existingMessage) {
        return sendNotFound(res, "Message not found");
      }

      // Check if user is the sender
      if (existingMessage.senderId !== userId) {
        return sendForbidden(res, "You can only edit your own messages");
      }

      const updatedMessage = await storage.updateMessage(messageId, userId, content);
      if (!updatedMessage) {
        return sendError(res, ErrorCodes.INVALID_INPUT, "Cannot edit message. Edit window may have expired (15 minutes).", 400);
      }

      // Broadcast message:updated to conversation room
      broadcastToConversation(existingMessage.conversationId, "message:updated", updatedMessage);

      sendSuccess(res, updatedMessage);
    }),
  );

  // DELETE /api/messages/:id - Soft delete mensagem
  app.delete(
    "/api/messages/:id",
    isAuthenticated,
    validateParams(idParamSchema),
    asyncHandler(async (req, res) => {
      const { id: messageId } = req.validatedParams;
      const userId = getCurrentUser(req)!.id;

      // Get message to find conversationId for broadcast
      const existingMessage = await storage.getMessage(messageId);
      if (!existingMessage) {
        return sendNotFound(res, "Message not found");
      }

      // Check if user is the sender
      if (existingMessage.senderId !== userId) {
        return sendForbidden(res, "You can only delete your own messages");
      }

      const deletedMessage = await storage.softDeleteMessage(messageId, userId);
      if (!deletedMessage) {
        return sendNotFound(res, "Message not found");
      }

      // Broadcast message:deleted to conversation room
      broadcastToConversation(existingMessage.conversationId, "message:deleted", {
        id: messageId,
        conversationId: existingMessage.conversationId,
        deletedAt: deletedMessage.deletedAt,
      });

      sendSuccess(res, { id: messageId, deleted: true });
    }),
  );
}
