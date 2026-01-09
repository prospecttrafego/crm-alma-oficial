import type { Express } from "express";
import { insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { broadcast } from "../ws/index";

const updateConversationSchema = insertConversationSchema.partial().omit({ organizationId: true });

export function registerConversationRoutes(app: Express) {
  // Conversations - supports pagination via query params (?page=1&limit=20&search=...&status=...&channel=...)
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } });
      }

      // Helper function to enrich conversations
      const enrichConversations = async (convList: any[]) => {
        return Promise.all(
          convList.map(async (conv) => {
            let contact = null;
            let company = null;
            let deal = null;
            let assignedTo = null;

            if (conv.contactId) {
              contact = await storage.getContact(conv.contactId);
              if (contact?.companyId) {
                company = await storage.getCompany(contact.companyId);
              }
            }
            if (conv.dealId) {
              deal = await storage.getDeal(conv.dealId);
              if (!company && deal?.companyId) {
                company = await storage.getCompany(deal.companyId);
              }
            }
            if (conv.assignedToId) {
              assignedTo = await storage.getUser(conv.assignedToId);
            }

            return {
              ...conv,
              contact: contact ? { ...contact, company } : null,
              deal,
              company,
              assignedTo,
            };
          }),
        );
      };

      // Check if pagination is requested
      const { page, limit, search, status, channel, assignedToId } = req.query;
      if (page || limit || search || status || channel) {
        const result = await storage.getConversationsPaginated(org.id, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          search: search as string,
          status: status as string,
          channel: channel as string,
          assignedToId: assignedToId as string,
        });
        const enrichedData = await enrichConversations(result.data);
        return res.json({ ...result, data: enrichedData });
      }

      // Fallback to non-paginated (for backward compatibility)
      const allConversations = await storage.getConversations(org.id);
      const enrichedConversations = await enrichConversations(allConversations);
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const conversation = await storage.getConversation(id);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });
      const conversationMessages = await storage.getMessages(id);
      res.json({ ...conversation, messages: conversationMessages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.status(400).json({ message: "No organization" });

      const parsed = insertConversationSchema.safeParse({ ...req.body, organizationId: org.id });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const conversation = await storage.createConversation(parsed.data);
      broadcast("conversation:created", conversation);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.patch("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const parsed = updateConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const conversation = await storage.updateConversation(id, parsed.data);
      if (!conversation) return res.status(404).json({ message: "Conversation not found" });
      res.json(conversation);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Failed to update conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid ID" });

      // Parse cursor and limit for pagination
      const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 50) : 30;

      const result = await storage.getMessages(conversationId, { cursor, limit });
      res.json(result);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const senderId = (req.user as any).id;
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid ID" });

      const parsed = insertMessageSchema.safeParse({ ...req.body, conversationId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.issues });
      }
      const message = await storage.createMessage(parsed.data);
      broadcast("message:created", message);

      // Create notification for assigned user if not the sender
      const conversation = await storage.getConversation(conversationId);
      if (conversation?.assignedToId && conversation.assignedToId !== senderId) {
        await storage.createNotification({
          userId: conversation.assignedToId,
          type: "new_message",
          title: "New Message",
          message: `New message in conversation: ${conversation.subject || "No subject"}`,
          entityType: "conversation",
          entityId: conversationId,
        });
        broadcast("notification:new", { userId: conversation.assignedToId });

        // Send push notification if user is offline
        try {
          const { isUserOnline } = await import("../redis");
          const isOnline = await isUserOnline(conversation.assignedToId);

          if (!isOnline) {
            const { sendPushNotificationBatch, createNotificationPayload, isFcmAvailable } = await import(
              "../notifications"
            );

            if (isFcmAvailable()) {
              const tokens = await storage.getPushTokensForUser(conversation.assignedToId);
              if (tokens.length > 0) {
                const sender = await storage.getUser(senderId);
                const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Usuário";
                const preview = message.content?.substring(0, 100) || "Nova mensagem";

                const payload = createNotificationPayload("message:new", {
                  senderName,
                  preview,
                  conversationId,
                  senderAvatar: sender?.profileImageUrl,
                });

                await sendPushNotificationBatch(
                  tokens.map((t) => t.token),
                  payload,
                );
              }
            }
          }
        } catch (pushError) {
          console.error("[FCM] Error sending push notification:", pushError);
        }
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Mark messages as read
  app.post("/api/conversations/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = (req.user as any).id;
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid ID" });

      const count = await storage.markMessagesAsRead(conversationId, userId);

      // Broadcast read event to other users
      broadcast("message:read", { conversationId, userId, count });

      res.json({ success: true, count });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });
}

