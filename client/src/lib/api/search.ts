/**
 * Global Search API - Search across contacts, deals, and conversations
 */

import { z } from "zod";
import { api } from "./client";

/**
 * Search result schemas
 */
export const searchResultContactSchema = z.object({
  type: z.literal("contact"),
  id: z.number(),
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
});

export const searchResultDealSchema = z.object({
  type: z.literal("deal"),
  id: z.number(),
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
});

export const searchResultConversationSchema = z.object({
  type: z.literal("conversation"),
  id: z.number(),
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
});

export const globalSearchResponseSchema = z.object({
  contacts: z.array(searchResultContactSchema),
  deals: z.array(searchResultDealSchema),
  conversations: z.array(searchResultConversationSchema),
  query: z.string(),
});

export type SearchResultContact = z.infer<typeof searchResultContactSchema>;
export type SearchResultDeal = z.infer<typeof searchResultDealSchema>;
export type SearchResultConversation = z.infer<typeof searchResultConversationSchema>;
export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;
export type SearchResult = SearchResultContact | SearchResultDeal | SearchResultConversation;

export interface SearchParams {
  q: string;
  limit?: number;
}

export const searchApi = {
  /**
   * Global search across contacts, deals, and conversations
   * @param params.q - Search query (min 2 chars)
   * @param params.limit - Max results per category (default 5, max 20)
   */
  search: (params: SearchParams) => {
    const searchParams = new URLSearchParams({ q: params.q });
    if (params.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }
    return api.get<GlobalSearchResponse>(
      `/api/search?${searchParams.toString()}`,
      globalSearchResponseSchema
    );
  },
};
