import {
  emailTemplates,
  type EmailTemplate,
  type InsertEmailTemplate,
} from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { getTenantOrganizationId } from "./helpers";

export async function getEmailTemplates(_organizationId: number): Promise<EmailTemplate[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.organizationId, tenantOrganizationId))
    .orderBy(emailTemplates.name);
}

export async function getEmailTemplate(
  id: number,
  _organizationId: number,
): Promise<EmailTemplate | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, tenantOrganizationId)));
  return template;
}

export async function createEmailTemplate(
  template: InsertEmailTemplate,
): Promise<EmailTemplate> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [created] = await db
    .insert(emailTemplates)
    .values({ ...template, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateEmailTemplate(
  id: number,
  _organizationId: number,
  template: Partial<InsertEmailTemplate>,
): Promise<EmailTemplate | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId2, ...updateData } = template as Partial<
    InsertEmailTemplate & { organizationId?: number }
  >;
  const [updated] = await db
    .update(emailTemplates)
    .set({ ...updateData, updatedAt: new Date() })
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteEmailTemplate(
  id: number,
  _organizationId: number,
): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, tenantOrganizationId)));
}
