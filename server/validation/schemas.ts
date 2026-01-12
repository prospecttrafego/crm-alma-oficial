/**
 * Schemas de Validacao Centralizados
 *
 * Schemas de payloads sao derivados de shared/contracts.
 * Schemas de params/query permanecem aqui (especificos do server).
 */

import { z } from "zod";
import {
  createActivitySchema,
  createCalendarEventSchema,
  createChannelConfigSchema,
  createContactSchema,
  createConversationSchema,
  createDealSchema,
  createEmailTemplateSchema,
  createFileSchema,
  createMessageSchema,
  createPipelineSchema,
  createPipelineStageInlineSchema,
  createPipelineStageSchema,
  createPushTokenSchema,
  createSavedViewSchema,
  moveDealSchema,
  updateActivitySchema,
  updateCalendarEventSchema,
  updateChannelConfigSchema,
  updateContactSchema,
  updateConversationSchema,
  updateDealSchema,
  updateEmailTemplateSchema,
  updatePipelineSchema,
  updatePipelineStageSchema,
  updateSavedViewSchema,
  updateUserProfileSchema,
  deletePushTokenSchema,
} from "@shared/contracts";

export {
  createActivitySchema,
  createCalendarEventSchema,
  createChannelConfigSchema,
  createContactSchema,
  createConversationSchema,
  createDealSchema,
  createEmailTemplateSchema,
  createFileSchema,
  createMessageSchema,
  createPipelineSchema,
  createPipelineStageInlineSchema,
  createPipelineStageSchema,
  createPushTokenSchema,
  createSavedViewSchema,
  moveDealSchema,
  updateActivitySchema,
  updateCalendarEventSchema,
  updateChannelConfigSchema,
  updateContactSchema,
  updateConversationSchema,
  updateDealSchema,
  updateEmailTemplateSchema,
  updatePipelineSchema,
  updatePipelineStageSchema,
  updateSavedViewSchema,
  updateUserProfileSchema,
  deletePushTokenSchema,
};

// ======================================================================
// PARAMS/QUERY SCHEMAS (server-specific)
// ======================================================================

/**
 * Schema para validacao de ID em parametros de URL
 * Uso: validateParams(idParamSchema)
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Schema para validacao de paginacao em query params
 * Uso: validateQuery(paginationQuerySchema)
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Schema para IDs de pipeline em params
 */
export const pipelineParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const pipelineStageParamsSchema = z.object({
  pipelineId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});
