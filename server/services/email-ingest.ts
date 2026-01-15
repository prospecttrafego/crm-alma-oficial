/**
 * Email Ingestion Service
 * Handles processing incoming emails into contacts, conversations, and messages
 */

import { storage } from "../storage";
import { broadcast, broadcastToConversation, broadcastToUser } from "../ws/index";
import { logger } from "../logger";
import type { ParsedEmail } from "../integrations/email";

/**
 * Process an incoming email and create/update conversation and message
 */
export async function processIncomingEmail(
  email: ParsedEmail,
  channelConfigId: number,
  organizationId: number,
  defaultUserId: string
): Promise<void> {
  // Extract sender email
  const senderEmail = email.from[0]?.address;
  if (!senderEmail) {
    logger.warn("[Email] Skipping email without sender", { messageId: email.messageId });
    return;
  }

  const externalId = email.messageId ? `email:${email.messageId}` : null;
  if (externalId) {
    const existingMessage = await storage.getMessageByExternalId(externalId);
    if (existingMessage) {
      logger.info("[Email] Skipping duplicate email message", { externalId });
      return;
    }
  }

  // Try to find existing contact by email
  let contact = await storage.getContactByEmail(senderEmail, organizationId);

  // Create contact if not found
  if (!contact) {
    const senderName = email.from[0]?.name || senderEmail.split("@")[0];
    const nameParts = senderName.split(" ");
    const firstName = nameParts[0] || senderName;
    const lastName = nameParts.slice(1).join(" ") || "";

    contact = await storage.createContact({
      firstName,
      lastName,
      email: senderEmail,
      organizationId,
      source: "email",
    });

    logger.info("[Email] Created new contact from email", {
      contactId: contact.id,
      email: senderEmail,
    });
  }

  // Try to find existing conversation by references/inReplyTo or create new
  let conversation = null;

  // Look for existing conversation by subject + contact (simplified threading)
  const existingConversations = await storage.getConversationsByContact(contact.id);
  for (const conv of existingConversations) {
    if (conv.channel === "email" && conv.subject === email.subject) {
      conversation = conv;
      break;
    }
  }

  // Create new conversation if not found
  if (!conversation) {
    conversation = await storage.createConversation({
      subject: email.subject,
      channel: "email",
      status: "open",
      contactId: contact.id,
      organizationId,
      assignedToId: defaultUserId,
    });

    logger.info("[Email] Created new conversation", {
      conversationId: conversation.id,
      subject: email.subject,
    });

    broadcast("conversation:created", conversation);
  }

  // Build message content (prefer text, fallback to stripped HTML)
  // Note: Check for empty string with .trim() to handle whitespace-only content
  const textContent = email.text?.trim();
  const htmlContent = email.html ? email.html.replace(/<[^>]*>/g, " ").trim() : "";
  const content = textContent || htmlContent || "(Sem conteúdo)";

  // Create the message
  const message = await storage.createMessage({
    conversationId: conversation.id,
    content,
    contentType: "text",
    senderType: "contact",
    isInternal: false,
    externalId: externalId || undefined,
    // Store email-specific metadata (schema allows any JSON)
    metadata: {
      emailMessageId: email.messageId,
      emailFrom: email.from,
      emailTo: email.to,
      emailCc: email.cc,
      emailDate: email.date.toISOString(),
      hasAttachments: email.attachments.length > 0,
    } as Record<string, unknown>,
  });

  // Ensure the conversation is open when a new email arrives
  await storage.updateConversation(conversation.id, { status: "open" });

  // Real-time: only subscribers of this conversation should receive message payloads
  broadcastToConversation(conversation.id, "message:created", message);

  const updatedConversation = await storage.getConversation(conversation.id);
  if (updatedConversation) {
    broadcast("conversation:updated", {
      conversationId: updatedConversation.id,
      lastMessageAt: updatedConversation.lastMessageAt,
      unreadCount: updatedConversation.unreadCount,
    });

    // Notify assigned user (if any)
    if (updatedConversation.assignedToId) {
      await storage.createNotification({
        userId: updatedConversation.assignedToId,
        type: "new_message",
        title: "New Email",
        message: `New email in conversation: ${updatedConversation.subject || "No subject"}`,
        entityType: "conversation",
        entityId: updatedConversation.id,
      });
      broadcastToUser(updatedConversation.assignedToId, "notification:new", {});

      // Send push notification if user is offline
      try {
        const { isUserOnline } = await import("../redis");
        const isOnline = await isUserOnline(updatedConversation.assignedToId);

        if (!isOnline) {
          const { sendNotificationToUser, isFcmAvailable } = await import("../integrations/firebase/notifications");

          if (isFcmAvailable()) {
            const preview = message.content?.substring(0, 100) || "New email";
            await sendNotificationToUser(
              updatedConversation.assignedToId,
              "message:new",
              {
                senderName: contact.firstName || senderEmail,
                preview,
                conversationId: updatedConversation.id,
              },
              {
                getPushTokens: storage.getPushTokensForUser.bind(storage),
                deletePushToken: storage.deletePushToken.bind(storage),
              },
            );
          }
        }
      } catch (pushError) {
        logger.error("[FCM] Error sending email push notification:", { error: pushError });
      }
    }
  }

  logger.info("[Email] Processed incoming email", {
    messageId: email.messageId,
    conversationId: conversation.id,
    contactId: contact.id,
  });
}
