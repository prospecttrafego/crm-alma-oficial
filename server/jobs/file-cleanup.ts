/**
 * Orphan File Cleanup Job
 * Finds and removes files that reference deleted entities
 */

import { db } from "../db";
import { files, messages, activities, deals, contacts } from "@shared/schema";
import { eq, sql, and, lt } from "drizzle-orm";
import { logger } from "../logger";
import { ObjectStorageService } from "../integrations/supabase/storage";

// ==================== TYPES ====================

export interface OrphanCleanupResult {
  orphanedFiles: number;
  deletedFromDb: number;
  deletedFromStorage: number;
  errors: string[];
}

export interface OrphanFileSummary {
  id: number;
  name: string;
  entityType: string;
  entityId: number;
  objectPath: string;
  createdAt: Date | null;
}

// ==================== ENTITY VERIFICATION ====================

/**
 * Check if parent entity exists for a file
 */
async function entityExists(entityType: string, entityId: number): Promise<boolean> {
  let result: { id: number }[] = [];

  switch (entityType) {
    case "message":
      result = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.id, entityId))
        .limit(1);
      break;
    case "activity":
      result = await db
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.id, entityId))
        .limit(1);
      break;
    case "deal":
      result = await db
        .select({ id: deals.id })
        .from(deals)
        .where(eq(deals.id, entityId))
        .limit(1);
      break;
    case "contact":
      result = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.id, entityId))
        .limit(1);
      break;
    default:
      logger.warn("[FileCleanup] Unknown entity type", { entityType, entityId });
      return true; // Assume exists if unknown type
  }

  return result.length > 0;
}

// ==================== ORPHAN DETECTION ====================

/**
 * Find files that reference entities that no longer exist
 */
export async function findOrphanFiles(options: {
  limit?: number;
  olderThanDays?: number;
} = {}): Promise<OrphanFileSummary[]> {
  const { limit = 100, olderThanDays } = options;

  // Get files to check
  let query = db.select().from(files);

  if (olderThanDays) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    query = query.where(lt(files.createdAt, cutoff)) as typeof query;
  }

  const filesToCheck = await query.limit(limit * 2); // Get more to account for valid files

  // Check each file for orphan status
  const orphans: OrphanFileSummary[] = [];

  for (const file of filesToCheck) {
    if (orphans.length >= limit) break;

    const exists = await entityExists(file.entityType, file.entityId);
    if (!exists) {
      orphans.push({
        id: file.id,
        name: file.name,
        entityType: file.entityType,
        entityId: file.entityId,
        objectPath: file.objectPath,
        createdAt: file.createdAt,
      });
    }
  }

  return orphans;
}

/**
 * Find orphan files using efficient SQL JOINs
 * More efficient for large databases
 */
export async function findOrphanFilesEfficient(options: {
  limit?: number;
  olderThanDays?: number;
} = {}): Promise<OrphanFileSummary[]> {
  const { limit = 100, olderThanDays } = options;

  const orphans: OrphanFileSummary[] = [];

  // Check each entity type separately using LEFT JOINs
  const entityTypes = ["message", "activity", "deal", "contact"] as const;

  for (const entityType of entityTypes) {
    if (orphans.length >= limit) break;

    let table;
    switch (entityType) {
      case "message":
        table = messages;
        break;
      case "activity":
        table = activities;
        break;
      case "deal":
        table = deals;
        break;
      case "contact":
        table = contacts;
        break;
    }

    // Find files of this type where the parent entity doesn't exist
    const conditions = [
      eq(files.entityType, entityType),
      sql`${table}.id IS NULL`,
    ];

    if (olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      conditions.push(lt(files.createdAt, cutoff));
    }

    const orphanedOfType = await db
      .select({
        id: files.id,
        name: files.name,
        entityType: files.entityType,
        entityId: files.entityId,
        objectPath: files.objectPath,
        createdAt: files.createdAt,
      })
      .from(files)
      .leftJoin(table, eq(files.entityId, table.id))
      .where(and(...conditions))
      .limit(limit - orphans.length);

    orphans.push(...orphanedOfType);
  }

  return orphans;
}

// ==================== CLEANUP OPERATIONS ====================

/**
 * Delete orphan files from database and storage
 */
export async function cleanupOrphanFiles(options: {
  dryRun?: boolean;
  limit?: number;
  olderThanDays?: number;
} = {}): Promise<OrphanCleanupResult> {
  const { dryRun = false, limit = 100, olderThanDays = 7 } = options;

  const result: OrphanCleanupResult = {
    orphanedFiles: 0,
    deletedFromDb: 0,
    deletedFromStorage: 0,
    errors: [],
  };

  logger.info("[FileCleanup] Starting orphan file cleanup", {
    dryRun,
    limit,
    olderThanDays,
  });

  // Find orphan files
  const orphans = await findOrphanFilesEfficient({ limit, olderThanDays });
  result.orphanedFiles = orphans.length;

  if (orphans.length === 0) {
    logger.info("[FileCleanup] No orphan files found");
    return result;
  }

  logger.info("[FileCleanup] Found orphan files", { count: orphans.length });

  if (dryRun) {
    logger.info("[FileCleanup] Dry run - no files deleted", {
      orphanFiles: orphans.map((f) => ({
        id: f.id,
        name: f.name,
        entityType: f.entityType,
        entityId: f.entityId,
      })),
    });
    return result;
  }

  // Delete files from storage and database
  const objectStorageService = new ObjectStorageService();

  for (const orphan of orphans) {
    // Try to delete from storage first
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(orphan.objectPath);
      await objectStorageService.deleteFile(objectFile.path);
      result.deletedFromStorage++;
    } catch (error) {
      // Storage deletion failed, but continue with DB deletion
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes("nao encontrado") && !errorMsg.includes("not found")) {
        result.errors.push(`Storage delete failed for ${orphan.id}: ${errorMsg}`);
      }
      // If file not found in storage, that's fine - just delete from DB
    }

    // Delete from database
    try {
      await db.delete(files).where(eq(files.id, orphan.id));
      result.deletedFromDb++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`DB delete failed for ${orphan.id}: ${errorMsg}`);
    }
  }

  logger.info("[FileCleanup] Cleanup completed", {
    orphanedFiles: result.orphanedFiles,
    deletedFromDb: result.deletedFromDb,
    deletedFromStorage: result.deletedFromStorage,
    errors: result.errors.length,
  });

  return result;
}

/**
 * Get orphan file statistics
 */
export async function getOrphanFileStats(): Promise<{
  totalFiles: number;
  orphanCount: number;
  byEntityType: Record<string, number>;
}> {
  // Get total file count
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(files);
  const totalFiles = totalResult[0]?.count || 0;

  // Find orphans (sample up to 1000)
  const orphans = await findOrphanFilesEfficient({ limit: 1000 });

  // Count by entity type
  const byEntityType: Record<string, number> = {};
  for (const orphan of orphans) {
    byEntityType[orphan.entityType] = (byEntityType[orphan.entityType] || 0) + 1;
  }

  return {
    totalFiles,
    orphanCount: orphans.length,
    byEntityType,
  };
}
