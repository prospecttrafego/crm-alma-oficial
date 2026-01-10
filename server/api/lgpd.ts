/**
 * LGPD Compliance Routes
 * Endpoints for data export and deletion under LGPD (Brazilian GDPR)
 */

import type { Express } from "express";
import { isAuthenticated, requireRole } from "../auth";
import { storage } from "../storage";
import { logger } from "../logger";
import type { File as FileRecord } from "../../shared/schema";

export function registerLgpdRoutes(app: Express) {
  /**
   * Export all data for a specific contact
   * GET /api/lgpd/export/contact/:id
   *
   * Returns a JSON object with all data associated with the contact:
   * - Contact info
   * - Associated company
   * - Conversations and messages
   * - Activities
   * - Deals
   * - Files/attachments
   */
  app.get(
    "/api/lgpd/export/contact/:id",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const contactId = parseInt(req.params.id);
        const user = req.user as any;

        if (isNaN(contactId)) {
          return res.status(400).json({ message: "ID de contato inválido" });
        }

        logger.info(`[LGPD] Data export requested for contact ${contactId} by user ${user.id}`);

        // Get contact
        const contact = await storage.getContact(contactId);
        if (!contact) {
          return res.status(404).json({ message: "Contato não encontrado" });
        }

        // Get associated company
        let company = null;
        if (contact.companyId) {
          company = await storage.getCompany(contact.companyId);
        }

        // Get conversations
        const conversations = await storage.getConversationsByContact(contactId);

        // Get messages for each conversation
        const conversationsWithMessages = await Promise.all(
          conversations.map(async (conv) => {
            const messagesResult = await storage.getMessages(conv.id, { limit: 1000 });
            return {
              ...conv,
              messages: messagesResult.messages,
            };
          })
        );

        // Get activities
        const activities = await storage.getActivitiesByContact(contactId);

        // Get deals
        const deals = await storage.getDealsByContact(contactId);

        // Get files
        const files = await storage.getFiles("contact", contactId);

        // Build export object
        const exportData = {
          exportDate: new Date().toISOString(),
          exportedBy: user.email,
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
          userId: user.id,
          organizationId: user.organizationId,
          changes: { exportedFields: Object.keys(exportData) },
        });

        // Set headers for download
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="lgpd_export_contact_${contactId}_${Date.now()}.json"`
        );

        res.json(exportData);
      } catch (error) {
        logger.error("[LGPD] Error exporting contact data", {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ message: "Erro ao exportar dados do contato" });
      }
    }
  );

  /**
   * Delete all data for a specific contact (Right to be Forgotten)
   * DELETE /api/lgpd/delete/contact/:id
   *
   * Permanently deletes:
   * - All messages in conversations
   * - All conversations
   * - All activities
   * - All files/attachments
   * - The contact itself
   *
   * Note: Deals are NOT deleted but have contactId set to null
   */
  app.delete(
    "/api/lgpd/delete/contact/:id",
    isAuthenticated,
    requireRole("admin"),
    async (req: any, res) => {
      try {
        const contactId = parseInt(req.params.id);
        const user = req.user as any;
        const { confirmDelete } = req.body;

        if (isNaN(contactId)) {
          return res.status(400).json({ message: "ID de contato inválido" });
        }

        if (confirmDelete !== true) {
          return res.status(400).json({
            message: "Confirmação necessária. Envie { confirmDelete: true } no body.",
          });
        }

        // Get contact
        const contact = await storage.getContact(contactId);
        if (!contact) {
          return res.status(404).json({ message: "Contato não encontrado" });
        }

        logger.warn(`[LGPD] Data deletion requested for contact ${contactId} by user ${user.id}`);

        // Store contact info for audit before deletion
        const contactSnapshot = {
          id: contact.id,
          email: contact.email,
          phone: contact.phone,
          firstName: contact.firstName,
          lastName: contact.lastName,
        };

        // Delete related data
        let deletedCounts = {
          messages: 0,
          conversations: 0,
          activities: 0,
          files: 0,
          dealsUpdated: 0,
        };

        // 1. Delete messages in conversations
        const conversations = await storage.getConversationsByContact(contactId);
        for (const conv of conversations) {
          const deleted = await storage.deleteMessagesByConversation(conv.id);
          deletedCounts.messages += deleted;
        }

        // 2. Delete conversations
        deletedCounts.conversations = await storage.deleteConversationsByContact(contactId);

        // 3. Delete activities
        deletedCounts.activities = await storage.deleteActivitiesByContact(contactId);

        // 4. Delete files
        deletedCounts.files = await storage.deleteFilesByEntity("contact", contactId);

        // 5. Update deals to remove contact reference (preserve deal history)
        deletedCounts.dealsUpdated = await storage.unlinkDealsFromContact(contactId);

        // 6. Delete the contact
        await storage.deleteContact(contactId);

        // Log the deletion
        await storage.createAuditLog({
          entityType: "contact",
          entityId: contactId,
          action: "lgpd_delete",
          userId: user.id,
          organizationId: user.organizationId,
          changes: {
            deletedContact: contactSnapshot,
            deletedCounts,
          },
        });

        logger.info(`[LGPD] Contact ${contactId} and related data deleted`, deletedCounts);

        res.json({
          message: "Dados do contato excluídos com sucesso",
          deletedCounts,
        });
      } catch (error) {
        logger.error("[LGPD] Error deleting contact data", {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ message: "Erro ao excluir dados do contato" });
      }
    }
  );

  /**
   * List data processing consents (placeholder for future implementation)
   * GET /api/lgpd/consents
   */
  app.get("/api/lgpd/consents", isAuthenticated, requireRole("admin"), async (_req: any, res) => {
    // Placeholder for consent management
    res.json({
      message: "Funcionalidade de consentimentos em desenvolvimento",
      consents: [],
    });
  });
}
