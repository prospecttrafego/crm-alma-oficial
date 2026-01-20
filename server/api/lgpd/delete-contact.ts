import type { Express } from "express";
import { and, eq, inArray, or } from "drizzle-orm";
import { isAuthenticated, requireRole } from "../../auth";
import { storage } from "../../storage";
import { db } from "../../db";
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
import { logger } from "../../logger";
import { asyncHandler, validateParams, validateBody, getCurrentUser } from "../../middleware";
import { sendSuccess, sendNotFound, sendValidationError } from "../../response";
import { contactIdParamsSchema, deleteConfirmSchema } from "./schemas";
import { ObjectStorageService, ObjectNotFoundError } from "../../integrations/supabase/storage";
import { getTenantOrganizationId } from "../../storage/helpers";

function buildFileConditions(params: {
  contactId: number;
  messageIds: number[];
  activityIds: number[];
}) {
  const conditions = [
    and(eq(files.entityType, "contact"), eq(files.entityId, params.contactId)),
  ];

  if (params.messageIds.length > 0) {
    conditions.push(and(eq(files.entityType, "message"), inArray(files.entityId, params.messageIds)));
  }

  if (params.activityIds.length > 0) {
    conditions.push(and(eq(files.entityType, "activity"), inArray(files.entityId, params.activityIds)));
  }

  return conditions;
}

async function deleteFilesFromStorage(fileRecords: FileRecord[]) {
  if (fileRecords.length === 0) return;

  let objectStorageService: ObjectStorageService | null = null;
  try {
    objectStorageService = new ObjectStorageService();
  } catch (error) {
    logger.warn("[LGPD] Storage client not configured, skipping object deletion", { error });
    return;
  }

  for (const file of fileRecords) {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
      await objectStorageService.deleteFile(objectFile.path);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        continue;
      }
      logger.warn("[LGPD] Failed to delete object from storage", { error });
    }
  }
}

export function registerLgpdDeleteRoutes(app: Express) {
  /**
   * Delete all data for a specific contact (Right to be Forgotten)
   * DELETE /api/lgpd/delete/contact/:id
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

      const tenantOrganizationId = await getTenantOrganizationId();

      // Preload related IDs for files cleanup
      const contactConversations = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.contactId, contactId), eq(conversations.organizationId, tenantOrganizationId)));

      const conversationIds = contactConversations.map((c) => c.id);

      const contactMessages = conversationIds.length > 0
        ? await db
            .select({ id: messages.id })
            .from(messages)
            .where(inArray(messages.conversationId, conversationIds))
        : [];
      const messageIds = contactMessages.map((m) => m.id);

      const contactActivities = await db
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.contactId, contactId), eq(activities.organizationId, tenantOrganizationId)));
      const activityIds = contactActivities.map((a) => a.id);

      const fileConditions = buildFileConditions({ contactId, messageIds, activityIds });

      const fileRecords = await db
        .select()
        .from(files)
        .where(and(eq(files.organizationId, tenantOrganizationId), or(...fileConditions)));

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

        // 1. Delete messages in conversations
        if (conversationIds.length > 0) {
          const msgResult = await tx
            .delete(messages)
            .where(inArray(messages.conversationId, conversationIds));
          counts.messages = msgResult.rowCount ?? 0;
          logger.info(`[LGPD] Deleted ${counts.messages} messages`);
        }

        // 2. Delete conversations
        if (conversationIds.length > 0) {
          const convResult = await tx
            .delete(conversations)
            .where(inArray(conversations.id, conversationIds));
          counts.conversations = convResult.rowCount ?? 0;
          logger.info(`[LGPD] Deleted ${counts.conversations} conversations`);
        }

        // 3. Delete activities
        const actResult = await tx
          .delete(activities)
          .where(and(eq(activities.contactId, contactId), eq(activities.organizationId, tenantOrganizationId)));
        counts.activities = actResult.rowCount ?? 0;
        logger.info(`[LGPD] Deleted ${counts.activities} activities`);

        // 4. Delete files (contact, message, activity)
        const fileResult = await tx
          .delete(files)
          .where(and(eq(files.organizationId, tenantOrganizationId), or(...fileConditions)));
        counts.files = fileResult.rowCount ?? 0;
        logger.info(`[LGPD] Deleted ${counts.files} files`);

        // 5. Update deals to remove contact reference (preserve deal history)
        const dealResult = await tx
          .update(deals)
          .set({ contactId: null })
          .where(eq(deals.contactId, contactId));
        counts.dealsUpdated = dealResult.rowCount ?? 0;
        logger.info(`[LGPD] Unlinked ${counts.dealsUpdated} deals`);

        // 6. Delete the contact
        await tx.delete(contacts).where(eq(contacts.id, contactId));
        logger.info(`[LGPD] Deleted contact ${contactId}`);

        logger.info(`[LGPD] Transaction completed for contact ${contactId}`);
        return counts;
      });

      // Best-effort: delete files from object storage
      await deleteFilesFromStorage(fileRecords);

      // Create audit log OUTSIDE transaction (no PII)
      await db.insert(auditLogs).values({
        entityType: "contact",
        entityId: contactId,
        action: "lgpd_delete",
        userId: currentUser!.id,
        organizationId: currentUser!.organizationId!,
        entityName: `contact:${contactId}`,
        changes: {
          deletedCounts,
        },
      });

      logger.info(`[LGPD] Contact ${contactId} and related data deleted`, deletedCounts);

      sendSuccess(res, {
        message: "Dados do contato excluídos com sucesso",
        deletedCounts,
      });
    })
  );
}
