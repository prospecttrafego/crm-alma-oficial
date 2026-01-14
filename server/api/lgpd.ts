/**
 * LGPD Compliance Routes
 * Endpoints for data export and deletion under LGPD (Brazilian GDPR)
 */

import type { Express } from "express";
import { z } from "zod";
import { eq, inArray, and } from "drizzle-orm";
import { isAuthenticated, requireRole } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import {
  contacts,
  conversations,
  messages,
  activities,
  files,
  deals,
  auditLogs,
  type File as FileRecord,
} from "@shared/schema";
import { logger } from "../logger";
import { asyncHandler, validateParams, validateBody, getCurrentUser } from "../middleware";
import { sendSuccess, sendNotFound, sendValidationError } from "../response";

// Schemas de validacao
const contactIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const deleteConfirmSchema = z.object({
  confirmDelete: z.boolean(),
});

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
    validateParams(contactIdParamsSchema),
    validateBody(deleteConfirmSchema),
    asyncHandler(async (req, res) => {
      const { id: contactId } = req.validatedParams;
      const currentUser = getCurrentUser(req);
      const { confirmDelete } = req.validatedBody;

      if (confirmDelete !== true) {
        return sendValidationError(res, "Confirmação necessária. Envie { confirmDelete: true } no body.");
      }

      // Get contact
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return sendNotFound(res, "Contato não encontrado");
      }

      logger.warn(`[LGPD] Data deletion requested for contact ${contactId} by user ${currentUser!.id}`);

      // Store contact info for audit before deletion
      const contactSnapshot = {
        id: contact.id,
        email: contact.email,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
      };

      // Execute all deletes in a single transaction for atomicity
      const deletedCounts = await db.transaction(async (tx) => {
        const counts = {
          messages: 0,
          conversations: 0,
          activities: 0,
          files: 0,
          dealsUpdated: 0,
        };

        logger.info(`[LGPD] Transaction started for contact ${contactId}`);

        // 1. Get conversation IDs for this contact
        const contactConversations = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.contactId, contactId));

        const conversationIds = contactConversations.map((c) => c.id);

        // 2. Delete messages in conversations
        if (conversationIds.length > 0) {
          const msgResult = await tx
            .delete(messages)
            .where(inArray(messages.conversationId, conversationIds));
          counts.messages = msgResult.rowCount ?? 0;
          logger.info(`[LGPD] Deleted ${counts.messages} messages`);
        }

        // 3. Delete conversations
        if (conversationIds.length > 0) {
          const convResult = await tx
            .delete(conversations)
            .where(inArray(conversations.id, conversationIds));
          counts.conversations = convResult.rowCount ?? 0;
          logger.info(`[LGPD] Deleted ${counts.conversations} conversations`);
        }

        // 4. Delete activities
        const actResult = await tx
          .delete(activities)
          .where(eq(activities.contactId, contactId));
        counts.activities = actResult.rowCount ?? 0;
        logger.info(`[LGPD] Deleted ${counts.activities} activities`);

        // 5. Delete files
        const fileResult = await tx
          .delete(files)
          .where(and(
            eq(files.entityType, "contact"),
            eq(files.entityId, contactId)
          ));
        counts.files = fileResult.rowCount ?? 0;
        logger.info(`[LGPD] Deleted ${counts.files} files`);

        // 6. Update deals to remove contact reference (preserve deal history)
        const dealResult = await tx
          .update(deals)
          .set({ contactId: null })
          .where(eq(deals.contactId, contactId));
        counts.dealsUpdated = dealResult.rowCount ?? 0;
        logger.info(`[LGPD] Unlinked ${counts.dealsUpdated} deals`);

        // 7. Delete the contact
        await tx.delete(contacts).where(eq(contacts.id, contactId));
        logger.info(`[LGPD] Deleted contact ${contactId}`);

        // 8. Create audit log within transaction
        await tx.insert(auditLogs).values({
          entityType: "contact",
          entityId: contactId,
          action: "lgpd_delete",
          userId: currentUser!.id,
          organizationId: currentUser!.organizationId!,
          entityName: `${contactSnapshot.firstName} ${contactSnapshot.lastName}`,
          changes: {
            deletedContact: contactSnapshot,
            deletedCounts: counts,
          },
        });

        logger.info(`[LGPD] Transaction completed for contact ${contactId}`);
        return counts;
      });

      logger.info(`[LGPD] Contact ${contactId} and related data deleted`, deletedCounts);

      sendSuccess(res, {
        message: "Dados do contato excluídos com sucesso",
        deletedCounts,
      });
    })
  );

  /**
   * List data processing consents (placeholder for future implementation)
   * GET /api/lgpd/consents
   */
  app.get(
    "/api/lgpd/consents",
    isAuthenticated,
    requireRole("admin"),
    asyncHandler(async (_req, res) => {
      // Placeholder for consent management
      sendSuccess(res, {
        message: "Funcionalidade de consentimentos em desenvolvimento",
        consents: [],
      });
    })
  );
}
