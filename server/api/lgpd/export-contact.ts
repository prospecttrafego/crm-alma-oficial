import type { Express } from "express";
import { desc, inArray } from "drizzle-orm";
import { isAuthenticated, requireRole } from "../../auth";
import { storage } from "../../storage";
import { db } from "../../db";
import { messages, type File as FileRecord, type Message } from "@shared/schema";
import { logger } from "../../logger";
import { asyncHandler, validateParams, getCurrentUser } from "../../middleware";
import { sendSuccess, sendNotFound } from "../../response";
import { contactIdParamsSchema } from "./schemas";

export function registerLgpdExportRoutes(app: Express) {
  /**
   * Export all data for a specific contact
   * GET /api/lgpd/export/contact/:id
   */
  app.get(
    "/api/lgpd/export/contact/:id",
    isAuthenticated,
    requireRole("admin"),
    validateParams(contactIdParamsSchema),
    asyncHandler(async (req, res) => {
      const { id: contactId } = req.validatedParams;
      const currentUser = getCurrentUser(req);

      logger.info(`[LGPD] Data export requested for contact ${contactId} by user ${currentUser!.id}`);

      // Get contact
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return sendNotFound(res, "Contato não encontrado");
      }

      // Get associated company
      let company = null;
      if (contact.companyId) {
        company = await storage.getCompany(contact.companyId);
      }

      // Get conversations
      const contactConversations = await storage.getConversationsByContact(contactId);

      // Batch fetch all messages for all conversations in a single query (fixes N+1)
      const conversationIds = contactConversations.map((c) => c.id);
      let allMessages: Message[] = [];
      if (conversationIds.length > 0) {
        allMessages = await db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds))
          .orderBy(desc(messages.createdAt));
      }

      // Group messages by conversation ID
      const messagesByConversation = new Map<number, Message[]>();
      for (const msg of allMessages) {
        const existing = messagesByConversation.get(msg.conversationId) || [];
        existing.push(msg);
        messagesByConversation.set(msg.conversationId, existing);
      }

      // Combine conversations with their messages
      const conversationsWithMessages = contactConversations.map((conv) => ({
        ...conv,
        messages: messagesByConversation.get(conv.id) || [],
      }));

      // Get activities
      const activities = await storage.getActivitiesByContact(contactId);

      // Get deals
      const deals = await storage.getDealsByContact(contactId);

      // Get files
      const files = await storage.getFiles("contact", contactId);

      // Build export object
      const exportData = {
        exportDate: new Date().toISOString(),
        exportedBy: currentUser!.email,
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          jobTitle: contact.jobTitle,
          tags: contact.tags,
          source: contact.source,
          customFields: contact.customFields,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        },
        company: company
          ? {
              id: company.id,
              name: company.name,
              domain: company.domain,
              website: company.website,
              segment: company.segment,
              size: company.size,
              industry: company.industry,
            }
          : null,
        conversations: conversationsWithMessages.map((conv) => ({
          id: conv.id,
          subject: conv.subject,
          channel: conv.channel,
          status: conv.status,
          createdAt: conv.createdAt,
          messages: conv.messages.map((msg) => ({
            id: msg.id,
            content: msg.content,
            contentType: msg.contentType,
            senderType: msg.senderType,
            createdAt: msg.createdAt,
          })),
        })),
        activities: activities.map((act) => ({
          id: act.id,
          type: act.type,
          title: act.title,
          description: act.description,
          status: act.status,
          dueDate: act.dueDate,
          completedAt: act.completedAt,
          createdAt: act.createdAt,
        })),
        deals: deals.map((deal) => ({
          id: deal.id,
          title: deal.title,
          value: deal.value,
          status: deal.status,
          probability: deal.probability,
          expectedCloseDate: deal.expectedCloseDate,
          createdAt: deal.createdAt,
        })),
        files: files.map((file: FileRecord) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
        })),
      };

      // Log the export
      await storage.createAuditLog({
        entityType: "contact",
        entityId: contactId,
        action: "lgpd_export",
        userId: currentUser!.id,
        organizationId: currentUser!.organizationId,
        changes: { exportedFields: Object.keys(exportData) },
      });

      // Set headers for download
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="lgpd_export_contact_${contactId}_${Date.now()}.json"`
      );

      res.json(exportData);
    })
  );
}
