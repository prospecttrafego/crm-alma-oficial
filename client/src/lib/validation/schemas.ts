/**
 * Frontend Validation Schemas - Zod schemas for form validation
 * These schemas provide client-side validation with type coercion
 */

import { z } from 'zod';

// ===== CONTACTS =====

export const createContactSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  jobTitle: z.string().optional().or(z.literal('')),
  companyId: z.coerce.number().int().positive().optional().nullable(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional().or(z.literal('')),
});

export const updateContactSchema = createContactSchema.partial();

// ===== COMPANIES =====

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  domain: z.string().optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  segment: z.string().optional().or(z.literal('')),
  size: z.string().optional().or(z.literal('')),
  industry: z.string().optional().or(z.literal('')),
});

export const updateCompanySchema = createCompanySchema.partial();

// ===== DEALS =====

export const createDealSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  value: z.coerce.number().nonnegative('Valor deve ser positivo').optional(),
  currency: z.string().default('BRL'),
  pipelineId: z.coerce.number().int().positive(),
  stageId: z.coerce.number().int().positive(),
  contactId: z.coerce.number().int().positive().optional().nullable(),
  companyId: z.coerce.number().int().positive().optional().nullable(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
});

export const updateDealSchema = createDealSchema.partial().omit({ pipelineId: true });

export const moveDealSchema = z.object({
  stageId: z.coerce.number().int().positive(),
});

// ===== PIPELINES =====

export const createPipelineStageInlineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  order: z.coerce.number().int(),
  color: z.string().optional().nullable(),
  isWon: z.boolean().optional().nullable(),
  isLost: z.boolean().optional().nullable(),
});

export const createPipelineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  isDefault: z.boolean().optional(),
  stages: z.array(createPipelineStageInlineSchema).optional(),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  isDefault: z.boolean().optional(),
});

export const createPipelineStageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  order: z.coerce.number().int(),
  color: z.string().optional().nullable(),
  isWon: z.boolean().optional().nullable(),
  isLost: z.boolean().optional().nullable(),
});

export const updatePipelineStageSchema = createPipelineStageSchema.partial();

// ===== ACTIVITIES =====

export const activityTypes = ['call', 'email', 'meeting', 'note', 'task'] as const;
export const activityStatuses = ['pending', 'completed', 'cancelled'] as const;

export const createActivitySchema = z.object({
  type: z.enum(activityTypes),
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional().or(z.literal('')),
  contactId: z.coerce.number().int().positive().optional().nullable(),
  dealId: z.coerce.number().int().positive().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateActivitySchema = createActivitySchema.partial().extend({
  status: z.enum(activityStatuses).optional(),
  completedAt: z.coerce.date().optional().nullable(),
});

// ===== CALENDAR EVENTS =====

export const calendarEventTypes = ['meeting', 'call', 'task', 'reminder', 'other'] as const;

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  description: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  type: z.enum(calendarEventTypes).optional().nullable(),
  contactId: z.coerce.number().int().positive().optional().nullable(),
  dealId: z.coerce.number().int().positive().optional().nullable(),
  allDay: z.boolean().optional(),
});

export const updateCalendarEventSchema = createCalendarEventSchema.partial();

// ===== CONVERSATIONS =====

export const channelTypes = ['email', 'whatsapp', 'sms', 'internal', 'phone'] as const;
export const conversationStatuses = ['open', 'closed', 'pending'] as const;

export const createConversationSchema = z.object({
  channel: z.enum(channelTypes),
  subject: z.string().optional().or(z.literal('')),
  contactId: z.coerce.number().int().positive().optional().nullable(),
  dealId: z.coerce.number().int().positive().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

export const updateConversationSchema = z.object({
  subject: z.string().optional(),
  status: z.enum(conversationStatuses).optional(),
  assignedToId: z.string().optional().nullable(),
});

// ===== MESSAGES =====

export const messageContentTypes = ['text', 'audio', 'image', 'file', 'video'] as const;

export const attachmentSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.string(),
});

export const createMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia'),
  contentType: z.enum(messageContentTypes).optional(),
  isInternal: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
  mentions: z.array(z.string()).optional(),
});

// ===== CHANNEL CONFIGS =====

export const channelConfigTypes = ['email', 'whatsapp'] as const;

export const createChannelConfigSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(channelConfigTypes),
  isActive: z.boolean().optional(),
});

export const updateChannelConfigSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  isActive: z.boolean().optional(),
});

// ===== EMAIL TEMPLATES =====

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  body: z.string().min(1, 'Corpo do email é obrigatório'),
  variables: z.array(z.string()).optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

// ===== SAVED VIEWS =====

export const savedViewTypes = ['contacts', 'companies', 'deals', 'activities'] as const;

export const createSavedViewSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(savedViewTypes),
  filters: z.record(z.string(), z.unknown()),
  isDefault: z.boolean().optional(),
});

export const updateSavedViewSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

// ===== TYPE EXPORTS =====

export type CreateContactFormData = z.infer<typeof createContactSchema>;
export type UpdateContactFormData = z.infer<typeof updateContactSchema>;

export type CreateCompanyFormData = z.infer<typeof createCompanySchema>;
export type UpdateCompanyFormData = z.infer<typeof updateCompanySchema>;

export type CreateDealFormData = z.infer<typeof createDealSchema>;
export type UpdateDealFormData = z.infer<typeof updateDealSchema>;
export type MoveDealFormData = z.infer<typeof moveDealSchema>;

export type CreatePipelineFormData = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineFormData = z.infer<typeof updatePipelineSchema>;
export type CreatePipelineStageFormData = z.infer<typeof createPipelineStageSchema>;
export type UpdatePipelineStageFormData = z.infer<typeof updatePipelineStageSchema>;

export type CreateActivityFormData = z.infer<typeof createActivitySchema>;
export type UpdateActivityFormData = z.infer<typeof updateActivitySchema>;

export type CreateCalendarEventFormData = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventFormData = z.infer<typeof updateCalendarEventSchema>;

export type CreateConversationFormData = z.infer<typeof createConversationSchema>;
export type UpdateConversationFormData = z.infer<typeof updateConversationSchema>;

export type CreateMessageFormData = z.infer<typeof createMessageSchema>;

export type CreateChannelConfigFormData = z.infer<typeof createChannelConfigSchema>;
export type UpdateChannelConfigFormData = z.infer<typeof updateChannelConfigSchema>;

export type CreateEmailTemplateFormData = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateFormData = z.infer<typeof updateEmailTemplateSchema>;

export type CreateSavedViewFormData = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewFormData = z.infer<typeof updateSavedViewSchema>;
