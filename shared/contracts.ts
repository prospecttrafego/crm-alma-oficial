/**
 * API Contracts
 *
 * Zod schemas derived from Drizzle schemas in shared/schema.ts.
 * These are the canonical request payloads for API create/update operations.
 */

import { z } from "zod";
import {
  insertActivitySchema as baseInsertActivitySchema,
  insertCalendarEventSchema as baseInsertCalendarEventSchema,
  insertChannelConfigSchema as baseInsertChannelConfigSchema,
  insertCompanySchema as baseInsertCompanySchema,
  insertContactSchema as baseInsertContactSchema,
  insertConversationSchema as baseInsertConversationSchema,
  insertDealSchema as baseInsertDealSchema,
  insertEmailTemplateSchema as baseInsertEmailTemplateSchema,
  insertMessageSchema as baseInsertMessageSchema,
  insertPipelineSchema as baseInsertPipelineSchema,
  insertPipelineStageSchema as baseInsertPipelineStageSchema,
  insertSavedViewSchema as baseInsertSavedViewSchema,
  insertFileSchema as baseInsertFileSchema,
  insertPushTokenSchema as baseInsertPushTokenSchema,
  updateActivitySchema as baseUpdateActivitySchema,
  updateCalendarEventSchema as baseUpdateCalendarEventSchema,
  updateChannelConfigSchema as baseUpdateChannelConfigSchema,
  updateCompanySchema as baseUpdateCompanySchema,
  updateContactSchema as baseUpdateContactSchema,
  updateConversationSchema as baseUpdateConversationSchema,
  updateDealSchema as baseUpdateDealSchema,
  updateEmailTemplateSchema as baseUpdateEmailTemplateSchema,
  updatePipelineSchema as baseUpdatePipelineSchema,
  updatePipelineStageSchema as baseUpdatePipelineStageSchema,
  updateSavedViewSchema as baseUpdateSavedViewSchema,
  updateUserSchema as baseUpdateUserSchema,
} from "./schema";

// ===== CONTACTS =====

export const createContactSchema = baseInsertContactSchema
  .omit({
    id: true,
    organizationId: true,
    phoneNormalized: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    companyName: z.string().optional(),
  });

export const updateContactSchema = baseUpdateContactSchema
  .omit({
    id: true,
    organizationId: true,
    phoneNormalized: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== COMPANIES =====

export const createCompanySchema = baseInsertCompanySchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateCompanySchema = baseUpdateCompanySchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== DEALS =====

export const createDealSchema = baseInsertDealSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateDealSchema = baseUpdateDealSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

export const moveDealSchema = z.object({
  stageId: z.number().int().positive(),
});

// ===== PIPELINES =====

export const createPipelineStageInlineSchema = baseInsertPipelineStageSchema
  .omit({
    id: true,
    pipelineId: true,
    createdAt: true,
  });

export const createPipelineSchema = baseInsertPipelineSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    stages: z.array(createPipelineStageInlineSchema).optional(),
  });

export const updatePipelineSchema = baseUpdatePipelineSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

export const createPipelineStageSchema = baseInsertPipelineStageSchema
  .omit({
    id: true,
    createdAt: true,
  });

export const updatePipelineStageSchema = baseUpdatePipelineStageSchema
  .omit({
    id: true,
    pipelineId: true,
    createdAt: true,
  });

// ===== CONVERSATIONS =====

export const createConversationSchema = baseInsertConversationSchema
  .omit({
    id: true,
    organizationId: true,
    lastMessageAt: true,
    unreadCount: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateConversationSchema = baseUpdateConversationSchema
  .omit({
    id: true,
    organizationId: true,
    lastMessageAt: true,
    unreadCount: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== MESSAGES =====

export const createMessageSchema = baseInsertMessageSchema
  .omit({
    id: true,
    conversationId: true,
    senderId: true,
    senderType: true,
    readBy: true,
    externalId: true,
    createdAt: true,
  });

// ===== ACTIVITIES =====

export const createActivitySchema = baseInsertActivitySchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateActivitySchema = baseUpdateActivitySchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== EMAIL TEMPLATES =====

export const createEmailTemplateSchema = baseInsertEmailTemplateSchema
  .omit({
    id: true,
    organizationId: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateEmailTemplateSchema = baseUpdateEmailTemplateSchema
  .omit({
    id: true,
    organizationId: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== SAVED VIEWS =====

export const createSavedViewSchema = baseInsertSavedViewSchema
  .omit({
    id: true,
    organizationId: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateSavedViewSchema = baseUpdateSavedViewSchema
  .omit({
    id: true,
    organizationId: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== CALENDAR EVENTS =====

export const createCalendarEventSchema = baseInsertCalendarEventSchema
  .omit({
    id: true,
    organizationId: true,
    userId: true,
    googleEventId: true,
    googleCalendarId: true,
    syncSource: true,
    lastSyncedAt: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateCalendarEventSchema = baseUpdateCalendarEventSchema
  .omit({
    id: true,
    organizationId: true,
    userId: true,
    googleEventId: true,
    googleCalendarId: true,
    syncSource: true,
    lastSyncedAt: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== CHANNEL CONFIGS =====

export const createChannelConfigSchema = baseInsertChannelConfigSchema
  .omit({
    id: true,
    organizationId: true,
    createdBy: true,
    lastSyncAt: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateChannelConfigSchema = baseUpdateChannelConfigSchema
  .omit({
    id: true,
    organizationId: true,
    createdBy: true,
    lastSyncAt: true,
    createdAt: true,
    updatedAt: true,
  });

// ===== USERS =====

export const updateUserProfileSchema = baseUpdateUserSchema
  .pick({
    firstName: true,
    lastName: true,
    profileImageUrl: true,
    preferences: true,
  })
  .extend({
    preferences: z
      .object({
        language: z.enum(["pt-BR", "en"]).optional(),
      })
      .optional(),
  });

// ===== FILES =====

const baseCreateFileSchema = baseInsertFileSchema
  .omit({
    id: true,
    organizationId: true,
    uploadedBy: true,
    objectPath: true,
    createdAt: true,
  });

export const createFileSchema = baseCreateFileSchema.extend({
  objectPath: z.string().optional(),
  uploadURL: z.string().optional(),
  entityId: z.union([z.string(), z.number()]),
});

// ===== PUSH TOKENS =====

export const createPushTokenSchema = baseInsertPushTokenSchema
  .omit({
    id: true,
    userId: true,
    lastUsedAt: true,
    createdAt: true,
  })
  .extend({
    oldToken: z.string().optional(),
  });

export const deletePushTokenSchema = baseInsertPushTokenSchema.pick({
  token: true,
});

// ===== TYPES =====

export type CreateContactDTO = z.infer<typeof createContactSchema>;
export type UpdateContactDTO = z.infer<typeof updateContactSchema>;

export type CreateCompanyDTO = z.infer<typeof createCompanySchema>;
export type UpdateCompanyDTO = z.infer<typeof updateCompanySchema>;

export type CreateDealDTO = z.infer<typeof createDealSchema>;
export type UpdateDealDTO = z.infer<typeof updateDealSchema>;
export type MoveDealDTO = z.infer<typeof moveDealSchema>;

export type CreatePipelineDTO = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineDTO = z.infer<typeof updatePipelineSchema>;
export type CreatePipelineStageDTO = z.infer<typeof createPipelineStageSchema>;
export type UpdatePipelineStageDTO = z.infer<typeof updatePipelineStageSchema>;
export type CreatePipelineStageInlineDTO = z.infer<typeof createPipelineStageInlineSchema>;

export type CreateConversationDTO = z.infer<typeof createConversationSchema>;
export type UpdateConversationDTO = z.infer<typeof updateConversationSchema>;

export type CreateMessageDTO = z.infer<typeof createMessageSchema>;

export type CreateActivityDTO = z.infer<typeof createActivitySchema>;
export type UpdateActivityDTO = z.infer<typeof updateActivitySchema>;

export type CreateCalendarEventDTO = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventDTO = z.infer<typeof updateCalendarEventSchema>;

export type CreateChannelConfigDTO = z.infer<typeof createChannelConfigSchema>;
export type UpdateChannelConfigDTO = z.infer<typeof updateChannelConfigSchema>;

export type CreateEmailTemplateDTO = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateDTO = z.infer<typeof updateEmailTemplateSchema>;

export type CreateSavedViewDTO = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewDTO = z.infer<typeof updateSavedViewSchema>;

export type UpdateUserProfileDTO = z.infer<typeof updateUserProfileSchema>;

export type CreateFileDTO = z.infer<typeof createFileSchema>;

export type CreatePushTokenDTO = z.infer<typeof createPushTokenSchema>;
export type DeletePushTokenDTO = z.infer<typeof deletePushTokenSchema>;
