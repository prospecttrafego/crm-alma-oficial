/**
 * Schemas de Validacao Centralizados
 *
 * Todos os schemas Zod para validacao de entrada de dados.
 * Gerados a partir das tabelas Drizzle usando createInsertSchema e createUpdateSchema.
 *
 * NOTA: createInsertSchema/createUpdateSchema do drizzle-zod ja tratam automaticamente:
 * - Campos com generatedAlwaysAsIdentity() (id) - excluidos ou opcionais
 * - Campos com defaultNow() (createdAt, updatedAt) - opcionais
 *
 * Os schemas aqui definem validacoes adicionais e customizacoes para a API.
 */

import { z } from 'zod';
import { createInsertSchema, createUpdateSchema } from './factory';
import {
  // Tabelas
  contacts,
  companies,
  deals,
  pipelines,
  pipelineStages,
  conversations,
  messages,
  activities,
  emailTemplates,
  savedViews,
  calendarEvents,
  channelConfigs,
  notifications,
  // Enums
  channelTypes,
  messageContentTypes,
  activityTypes,
  savedViewTypes,
  calendarEventTypes,
  calendarSyncSources,
  channelConfigTypes,
  notificationTypes,
} from '@shared/schema';

// ============================================================================
// CONTACTS
// ============================================================================

// Schema base gerado - ja exclui id, torna createdAt/updatedAt opcionais
const baseInsertContactSchema = createInsertSchema(contacts);
const baseUpdateContactSchema = createUpdateSchema(contacts);

// Schema de insert para API - phoneNormalized eh gerado no backend
export const insertContactSchema = baseInsertContactSchema.extend({
  phoneNormalized: z.string().optional(), // Ignorar se enviado, sera gerado
});

// Schema de update para API
export const updateContactSchema = baseUpdateContactSchema;

// ============================================================================
// COMPANIES
// ============================================================================

export const insertCompanySchema = createInsertSchema(companies);
export const updateCompanySchema = createUpdateSchema(companies);

// ============================================================================
// DEALS
// ============================================================================

export const insertDealSchema = createInsertSchema(deals);
export const updateDealSchema = createUpdateSchema(deals);

// Schema especifico para mover deal de stage
export const moveDealSchema = z.object({
  stageId: z.number().int().positive(),
});

// ============================================================================
// PIPELINES
// ============================================================================

export const insertPipelineSchema = createInsertSchema(pipelines);
export const updatePipelineSchema = createUpdateSchema(pipelines);

// ============================================================================
// PIPELINE STAGES
// ============================================================================

export const insertPipelineStageSchema = createInsertSchema(pipelineStages);
export const updatePipelineStageSchema = createUpdateSchema(pipelineStages);

// Schema para criar stages inline (sem pipelineId obrigatorio - sera adicionado pelo backend)
export const insertPipelineStageInlineSchema = z.object({
  name: z.string().min(1),
  order: z.number().int(),
  color: z.string().nullable().optional(),
  isWon: z.boolean().nullable().optional(),
  isLost: z.boolean().nullable().optional(),
});

// ============================================================================
// CONVERSATIONS
// ============================================================================

export const insertConversationSchema = createInsertSchema(conversations).extend({
  channel: z.enum(channelTypes),
});

export const updateConversationSchema = createUpdateSchema(conversations);

// ============================================================================
// MESSAGES
// ============================================================================

export const insertMessageSchema = createInsertSchema(messages).extend({
  contentType: z.enum(messageContentTypes).optional(),
});

// ============================================================================
// ACTIVITIES
// ============================================================================

export const insertActivitySchema = createInsertSchema(activities).extend({
  type: z.enum(activityTypes),
});

export const updateActivitySchema = createUpdateSchema(activities);

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const updateEmailTemplateSchema = createUpdateSchema(emailTemplates);

// ============================================================================
// SAVED VIEWS
// ============================================================================

export const insertSavedViewSchema = createInsertSchema(savedViews).extend({
  type: z.enum(savedViewTypes),
});

export const updateSavedViewSchema = createUpdateSchema(savedViews);

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).extend({
  type: z.enum(calendarEventTypes).nullable().optional(),
  syncSource: z.enum(calendarSyncSources).nullable().optional(),
});

export const updateCalendarEventSchema = createUpdateSchema(calendarEvents);

// ============================================================================
// CHANNEL CONFIGS
// ============================================================================

export const insertChannelConfigSchema = createInsertSchema(channelConfigs).extend({
  type: z.enum(channelConfigTypes),
});

export const updateChannelConfigSchema = createUpdateSchema(channelConfigs);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const insertNotificationSchema = createInsertSchema(notifications).extend({
  type: z.enum(notificationTypes),
});

// ============================================================================
// SCHEMAS COMUNS
// ============================================================================

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
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
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

// ============================================================================
// TYPES INFERIDOS
// ============================================================================

export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type UpdateDeal = z.infer<typeof updateDealSchema>;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type UpdatePipelineStage = z.infer<typeof updatePipelineStageSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type UpdateActivity = z.infer<typeof updateActivitySchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;
export type UpdateSavedView = z.infer<typeof updateSavedViewSchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type UpdateCalendarEvent = z.infer<typeof updateCalendarEventSchema>;
export type InsertChannelConfig = z.infer<typeof insertChannelConfigSchema>;
export type UpdateChannelConfig = z.infer<typeof updateChannelConfigSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
