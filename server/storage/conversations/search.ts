import { messages, conversations, users } from "@shared/schema";
import { db } from "../../db";
import { and, count, eq, sql } from "drizzle-orm";
import { getTenantOrganizationId } from "../helpers";

/**
 * Search result type for message search
 */
export interface MessageSearchResult {
  id: number;
  conversationId: number;
  content: string;
  createdAt: Date | null;
  senderId: string | null;
  senderType: string | null;
  senderName: string | null;
  conversationSubject: string | null;
  rank: number;
}

/**
 * Search messages by content using PostgreSQL full-text search
 * Returns messages matching the query with relevance ranking
 */
export async function searchMessages(
  query: string,
  options?: {
    conversationId?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ results: MessageSearchResult[]; total: number }> {
  const tenantOrganizationId = await getTenantOrganizationId();
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // Sanitize query for PostgreSQL full-text search
  const sanitizedQuery = query.trim().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean).join(" & ");

  if (!sanitizedQuery) {
    return { results: [], total: 0 };
  }

  // Build conditions
  const conditions = [eq(conversations.organizationId, tenantOrganizationId)];

  if (options?.conversationId) {
    conditions.push(eq(messages.conversationId, options.conversationId));
  }

  // Use raw SQL for full-text search with ts_rank
  const searchCondition = sql`to_tsvector('portuguese', coalesce(${messages.content}, '')) @@ plainto_tsquery('portuguese', ${sanitizedQuery})`;

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(...conditions, searchCondition));

  const total = Number(countResult?.count || 0);

  // Get search results with ranking
  const results = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      content: messages.content,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      senderType: messages.senderType,
      senderName: sql<string | null>`
        CASE
          WHEN ${messages.senderType} = 'user' THEN COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})
          WHEN ${messages.senderType} = 'contact' THEN 'Contact'
          ELSE 'System'
        END
      `,
      conversationSubject: conversations.subject,
      rank: sql<number>`ts_rank(to_tsvector('portuguese', coalesce(${messages.content}, '')), plainto_tsquery('portuguese', ${sanitizedQuery}))`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(...conditions, searchCondition))
    .orderBy(sql`ts_rank(to_tsvector('portuguese', coalesce(${messages.content}, '')), plainto_tsquery('portuguese', ${sanitizedQuery})) DESC`)
    .limit(limit)
    .offset(offset);

  return { results, total };
}
