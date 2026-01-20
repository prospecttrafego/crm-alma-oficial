import { z } from "zod";
import { paginationQuerySchema } from "../../validation";

// Schema estendido para query de conversas
export const conversationsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  channel: z.string().optional(),
  assignedToId: z.string().optional(),
});

// Schema para paginacao de mensagens
export const messagesQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(30),
});

// Schema para busca de mensagens
export const messageSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  conversationId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});
