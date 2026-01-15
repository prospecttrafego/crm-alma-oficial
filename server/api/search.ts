import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated, validateQuery, asyncHandler } from "../middleware";
import { sendSuccess } from "../response";
import { storage } from "../storage";

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
      const searchTerm = q.toLowerCase().trim();

      // Search contacts
      const allContacts = await storage.getContacts(org.id);
      const contactResults: SearchResultContact[] = allContacts
        .filter((contact) => {
          const fullName = `${contact.firstName} ${contact.lastName || ""}`.toLowerCase();
          const email = (contact.email || "").toLowerCase();
          const phone = (contact.phone || "").toLowerCase();
          return (
            fullName.includes(searchTerm) ||
            email.includes(searchTerm) ||
            phone.includes(searchTerm)
          );
        })
        .slice(0, limit)
        .map((contact) => ({
          type: "contact" as const,
          id: contact.id,
          title: `${contact.firstName} ${contact.lastName || ""}`.trim(),
          subtitle: contact.email || contact.phone || null,
          href: `/contacts?selected=${contact.id}`,
        }));

      // Search deals
      const allDeals = await storage.getDeals(org.id);
      const dealResults: SearchResultDeal[] = allDeals
        .filter((deal) => {
          const title = deal.title.toLowerCase();
          return title.includes(searchTerm);
        })
        .slice(0, limit)
        .map((deal) => ({
          type: "deal" as const,
          id: deal.id,
          title: deal.title,
          subtitle: deal.value ? `R$ ${Number(deal.value).toLocaleString("pt-BR")}` : null,
          href: `/pipeline?deal=${deal.id}`,
        }));

      // Search conversations (by contact name or subject)
      const allConversations = await storage.getConversations(org.id);

      // Enrich conversations with contact info for search
      const enrichedConversations = await Promise.all(
        allConversations.map(async (conv) => {
          let contact = null;
          if (conv.contactId) {
            contact = await storage.getContact(conv.contactId);
          }
          return { ...conv, contact };
        })
      );

      const conversationResults: SearchResultConversation[] = enrichedConversations
        .filter((conv) => {
          const subject = (conv.subject || "").toLowerCase();
          const contactName = conv.contact
            ? `${conv.contact.firstName} ${conv.contact.lastName || ""}`.toLowerCase()
            : "";
          return subject.includes(searchTerm) || contactName.includes(searchTerm);
        })
        .slice(0, limit)
        .map((conv) => ({
          type: "conversation" as const,
          id: conv.id,
          title: conv.contact
            ? `${conv.contact.firstName} ${conv.contact.lastName || ""}`.trim()
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
