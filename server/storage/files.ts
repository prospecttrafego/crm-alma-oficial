import {
  files,
  type File as FileRecord,
  type InsertFile,
  type FileEntityType,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getFiles(
  entityType: FileEntityType,
  entityId: number,
): Promise<FileRecord[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.entityType, entityType),
        eq(files.entityId, entityId),
        eq(files.organizationId, tenantOrganizationId),
      ),
    )
    .orderBy(desc(files.createdAt));
}

export async function getFile(id: number): Promise<FileRecord | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, id), eq(files.organizationId, tenantOrganizationId)));
  return file;
}

export async function createFile(file: InsertFile): Promise<FileRecord> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(files)
    .values({ ...file, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateFile(
  id: number,
  updates: Partial<InsertFile>,
): Promise<FileRecord> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = updates as Partial<
    InsertFile & { organizationId?: number }
  >;
  const [updated] = await db
    .update(files)
    .set(updateData)
    .where(and(eq(files.id, id), eq(files.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteFile(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db.delete(files).where(and(eq(files.id, id), eq(files.organizationId, tenantOrganizationId)));
}

/**
 * Delete files by entity type and ID
 */
export async function deleteFilesByEntity(
  entityType: FileEntityType,
  entityId: number,
): Promise<number> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const result = await db
    .delete(files)
    .where(
      and(
        eq(files.entityType, entityType),
        eq(files.entityId, entityId),
        eq(files.organizationId, tenantOrganizationId),
      ),
    )
    .returning({ id: files.id });
  return result.length;
}
