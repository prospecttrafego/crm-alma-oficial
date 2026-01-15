import type { Express } from "express";
import { z } from "zod";
import { and, eq, ilike, or, sql, desc } from "drizzle-orm";
import { isAuthenticated, validateQuery, asyncHandler } from "../middleware";
import { sendSuccess } from "../response";
import { storage } from "../storage";
import { db } from "../db";
import { contacts, deals, conversations } from "@shared/schema";

/**
 * Search query validation schema
 */
const searchQuerySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().int().positive().max(20).optional().default(5),
});

/**
 * Search result types
 */
export interface SearchResultContact {
  type: "contact";
  id: number;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchResultDeal {
  type: "deal";
  id: number;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchResultConversation {
  type: "conversation";
  id: number;
  title: string;
  subtitle: string | null;
  href: string;
}

export type SearchResult = SearchResultContact | SearchResultDeal | SearchResultConversation;

export interface GlobalSearchResponse {
  contacts: SearchResultContact[];
  deals: SearchResultDeal[];
  conversations: SearchResultConversation[];
  query: string;
}

export function registerSearchRoutes(app: Express) {
  /**
   * GET /api/search - Global search across contacts, deals, and conversations
   * Query params:
   *   - q: Search query (min 2 chars)
   *   - limit: Max results per category (default 5, max 20)
   */
  app.get(
    "/api/search",
    isAuthenticated,
    validateQuery(searchQuerySchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendSuccess(res, {
          contacts: [],
          deals: [],
          conversations: [],
          query: req.validatedQuery.q,
        } as GlobalSearchResponse);
      }

      const { q, limit } = req.validatedQuery;
      const searchTerm = q.trim();

      const contactFullName = sql<string>`concat(${contacts.firstName}, ' ', coalesce(${contacts.lastName}, ''))`;

      const contactRows = await db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.organizationId, org.id),
            or(
              ilike(contactFullName, `%${searchTerm}%`),
              ilike(contacts.email, `%${searchTerm}%`),
              ilike(contacts.phone, `%${searchTerm}%`),
            ),
          ),
        )
        .orderBy(desc(contacts.updatedAt))
        .limit(limit);

      const contactResults: SearchResultContact[] = contactRows.map((contact) => ({
          type: "contact" as const,
          id: contact.id,
          title: `${contact.firstName} ${contact.lastName || ""}`.trim(),
          subtitle: contact.email || contact.phone || null,
          href: `/contacts?selected=${contact.id}`,
      }));

      const dealRows = await db
        .select({ id: deals.id, title: deals.title, value: deals.value })
        .from(deals)
        .where(and(eq(deals.organizationId, org.id), ilike(deals.title, `%${searchTerm}%`)))
        .orderBy(desc(deals.updatedAt))
        .limit(limit);

      const dealResults: SearchResultDeal[] = dealRows.map((deal) => ({
          type: "deal" as const,
          id: deal.id,
          title: deal.title,
          subtitle: deal.value ? `R$ ${Number(deal.value).toLocaleString("pt-BR")}` : null,
          href: `/pipeline?deal=${deal.id}`,
      }));

      const conversationRows = await db
        .select({
          id: conversations.id,
          subject: conversations.subject,
          channel: conversations.channel,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
        })
        .from(conversations)
        .leftJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(
          and(
            eq(conversations.organizationId, org.id),
            or(
              ilike(conversations.subject, `%${searchTerm}%`),
              ilike(contactFullName, `%${searchTerm}%`),
            ),
          ),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit);

      const conversationResults: SearchResultConversation[] = conversationRows.map((conv) => ({
          type: "conversation" as const,
          id: conv.id,
          title: conv.contactFirstName
            ? `${conv.contactFirstName} ${conv.contactLastName || ""}`.trim()
            : conv.subject || `Conversa #${conv.id}`,
          subtitle: conv.subject || conv.channel,
          href: `/inbox?conversation=${conv.id}`,
      }));

      const response: GlobalSearchResponse = {
        contacts: contactResults,
        deals: dealResults,
        conversations: conversationResults,
        query: q,
      };

      sendSuccess(res, response);
    }),
  );
}
