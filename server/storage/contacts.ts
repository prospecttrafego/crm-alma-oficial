/**
 * Contact Storage Module
 * Handles all database operations for contacts
 */

import { contacts, type Contact, type InsertContact } from "@shared/schema";
import { db } from "../db";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  getTenantOrganizationId,
  normalizePagination,
  normalizePhone,
  type PaginationParams,
  type PaginatedResult,
} from "./helpers";

/**
 * Get all contacts for an organization
 * @param _organizationId - Organization ID (overridden by tenant in single-tenant mode)
 * @returns Array of contacts
 */
export async function getContacts(_organizationId: number): Promise<Contact[]> {
  const tenantOrganizationId = await getTenantOrganizationId();
  return await db
    .select()
    .from(contacts)
    .where(eq(contacts.organizationId, tenantOrganizationId));
}

/**
 * Get paginated contacts with optional search
 * @param _organizationId - Organization ID (overridden by tenant in single-tenant mode)
 * @param params - Pagination params (page, limit, search, sortOrder)
 * @returns Paginated result with contacts and metadata
 */
export async function getContactsPaginated(
  _organizationId: number,
  params: PaginationParams,
): Promise<PaginatedResult<Contact>> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { page, limit, offset } = normalizePagination(params);

  // Build search condition
  const searchCondition = params.search
    ? or(
        ilike(contacts.firstName, `%${params.search}%`),
        ilike(contacts.lastName, `%${params.search}%`),
        ilike(contacts.email, `%${params.search}%`),
        ilike(contacts.phone, `%${params.search}%`),
      )
    : undefined;

  const whereCondition = searchCondition
    ? and(eq(contacts.organizationId, tenantOrganizationId), searchCondition)
    : eq(contacts.organizationId, tenantOrganizationId);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(contacts)
    .where(whereCondition);
  const total = Number(countResult?.count || 0);

  // Get paginated data
  const sortOrder = params.sortOrder === "asc" ? asc : desc;
  const data = await db
    .select()
    .from(contacts)
    .where(whereCondition)
    .orderBy(sortOrder(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Get a single contact by ID
 * @param id - Contact ID
 * @returns Contact or undefined if not found
 */
export async function getContact(id: number): Promise<Contact | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, tenantOrganizationId)));
  return contact;
}

/**
 * Find contact by phone number (optimized for WhatsApp handler)
 * Searches for exact match or suffix match (to handle different formats)
 */
export async function getContactByPhone(
  phone: string,
  _organizationId: number,
): Promise<Contact | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();

  // Normalize phone (remove non-digits)
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return undefined;

  // First try exact match using indexed phoneNormalized field
  const [exactMatch] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, tenantOrganizationId),
        eq(contacts.phoneNormalized, normalizedPhone),
      ),
    )
    .limit(1);

  if (exactMatch) return exactMatch;

  // Try suffix match (for numbers with/without country code)
  // Uses LIKE with index (suffix search is less efficient but still faster than REGEXP)
  const [suffixMatch] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, tenantOrganizationId),
        or(
          sql`${contacts.phoneNormalized} LIKE ${"%" + normalizedPhone}`,
          sql`${normalizedPhone} LIKE '%' || ${contacts.phoneNormalized}`,
        ),
      ),
    )
    .limit(1);

  if (suffixMatch) return suffixMatch;

  // Legacy fallback: handle existing rows created before phoneNormalized existed
  const [legacyMatch] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, tenantOrganizationId),
        sql`${contacts.phoneNormalized} IS NULL`,
        or(
          sql`REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`,
          sql`REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g') LIKE ${"%" + normalizedPhone}`,
          sql`${normalizedPhone} LIKE '%' || REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g')`,
        ),
      ),
    )
    .limit(1);

  if (!legacyMatch) return undefined;

  const phoneNormalizedToSet = normalizePhone(legacyMatch.phone) || normalizedPhone;
  const [updatedLegacy] = await db
    .update(contacts)
    .set({ phoneNormalized: phoneNormalizedToSet, updatedAt: new Date() })
    .where(and(eq(contacts.id, legacyMatch.id), eq(contacts.organizationId, tenantOrganizationId)))
    .returning();

  return updatedLegacy || legacyMatch;
}

/**
 * Find contact by email address
 */
export async function getContactByEmail(
  email: string,
  _organizationId: number,
): Promise<Contact | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();

  // Case-insensitive email search
  const normalizedEmail = email.toLowerCase().trim();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.organizationId, tenantOrganizationId),
        sql`LOWER(${contacts.email}) = ${normalizedEmail}`,
      ),
    )
    .limit(1);

  return contact;
}

export async function createContact(contact: InsertContact): Promise<Contact> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const phoneNormalized = normalizePhone(contact.phone);
  const [created] = await db
    .insert(contacts)
    .values({ ...contact, phoneNormalized, organizationId: tenantOrganizationId })
    .returning();
  return created;
}

export async function updateContact(
  id: number,
  contact: Partial<InsertContact>,
): Promise<Contact | undefined> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const { organizationId: _organizationId, ...updateData } = contact as Partial<
    InsertContact & { organizationId?: number }
  >;
  // Se phone foi alterado, atualizar phoneNormalized tambem
  const dataToUpdate: Record<string, unknown> = { ...updateData, updatedAt: new Date() };
  if ("phone" in contact) {
    dataToUpdate.phoneNormalized = normalizePhone(contact.phone);
  }
  const [updated] = await db
    .update(contacts)
    .set(dataToUpdate)
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, tenantOrganizationId)))
    .returning();
  return updated;
}

export async function deleteContact(id: number): Promise<void> {
  const tenantOrganizationId = await getTenantOrganizationId();
  await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.organizationId, tenantOrganizationId)));
}
