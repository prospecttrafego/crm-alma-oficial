import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";
import {
  activityStatuses,
  activityTypes,
  auditLogActions,
  auditLogEntityTypes,
  calendarEventTypes,
  calendarSyncSources,
  channelConfigTypes,
  channelTypes,
  conversationStatuses,
  fileEntityTypes,
  googleCalendarSyncStatuses,
  leadScoreEntityTypes,
  messageContentTypes,
  notificationTypes,
  savedViewTypes,
  userRoles,
} from "./enums";
import { sessions, users, passwordResetTokens } from "./tables/auth";
import { organizations } from "./tables/organizations";
import { companies } from "./tables/companies";
import { contacts } from "./tables/contacts";
import { pipelines, pipelineStages, deals } from "./tables/pipelines";
import { conversations, messages } from "./tables/inbox";
import { activities } from "./tables/activities";
import { notifications, savedViews, emailTemplates, pushTokens } from "./tables/views";
import { auditLogs } from "./tables/auditLogs";
import { files } from "./tables/files";
import { leadScores } from "./tables/leadScores";
import { calendarEvents, googleOAuthTokens } from "./tables/calendar";
import { channelConfigs } from "./tables/channelConfigs";
import { deadLetterJobs } from "./tables/jobs";

const { createSelectSchema, createInsertSchema, createUpdateSchema } = createSchemaFactory({
  coerce: {
    date: true,
  },
});

// Insert schemas
// Nota: drizzle-zod 0.8.1 ja trata automaticamente:
// - Campos com generatedAlwaysAsIdentity() (id) - excluidos ou opcionais
// - Campos com defaultNow() (createdAt, updatedAt) - opcionais
// Para campos enum, usamos .extend() para garantir tipos corretos
export const insertUserSchema = createInsertSchema(users);
export const insertOrganizationSchema = createInsertSchema(organizations);
export const insertCompanySchema = createInsertSchema(companies);
export const insertContactSchema = createInsertSchema(contacts);
export const insertPipelineSchema = createInsertSchema(pipelines);
export const insertPipelineStageSchema = createInsertSchema(pipelineStages);
export const insertDealSchema = createInsertSchema(deals);
export const insertConversationSchema = createInsertSchema(conversations).extend({ channel: z.enum(channelTypes) });
export const insertMessageSchema = createInsertSchema(messages).extend({ contentType: z.enum(messageContentTypes).optional() });
export const insertActivitySchema = createInsertSchema(activities).extend({ type: z.enum(activityTypes) });
export const insertNotificationSchema = createInsertSchema(notifications).extend({ type: z.enum(notificationTypes) });
export const insertSavedViewSchema = createInsertSchema(savedViews).extend({ type: z.enum(savedViewTypes) });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const insertAuditLogSchema = createInsertSchema(auditLogs).extend({
  action: z.enum(auditLogActions),
  entityType: z.enum(auditLogEntityTypes),
});
export const insertFileSchema = createInsertSchema(files).extend({ entityType: z.enum(fileEntityTypes) });
export const insertLeadScoreSchema = createInsertSchema(leadScores).extend({ entityType: z.enum(leadScoreEntityTypes) });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).extend({
  type: z.enum(calendarEventTypes).nullable().optional(),
  syncSource: z.enum(calendarSyncSources).nullable().optional(),
});
export const insertChannelConfigSchema = createInsertSchema(channelConfigs).extend({ type: z.enum(channelConfigTypes) });
export const insertPushTokenSchema = createInsertSchema(pushTokens);
export const insertGoogleOAuthTokenSchema = createInsertSchema(googleOAuthTokens).extend({ syncStatus: z.enum(googleCalendarSyncStatuses).optional() });
export const insertDeadLetterJobSchema = createInsertSchema(deadLetterJobs);

// Update schemas
export const updateUserSchema = createUpdateSchema(users);
export const updateOrganizationSchema = createUpdateSchema(organizations);
export const updateCompanySchema = createUpdateSchema(companies);
export const updateContactSchema = createUpdateSchema(contacts);
export const updatePipelineSchema = createUpdateSchema(pipelines);
export const updatePipelineStageSchema = createUpdateSchema(pipelineStages);
export const updateDealSchema = createUpdateSchema(deals);
export const updateConversationSchema = createUpdateSchema(conversations).extend({ channel: z.enum(channelTypes).optional() });
export const updateMessageSchema = createUpdateSchema(messages).extend({ contentType: z.enum(messageContentTypes).optional() });
export const updateActivitySchema = createUpdateSchema(activities).extend({ type: z.enum(activityTypes).optional() });
export const updateNotificationSchema = createUpdateSchema(notifications).extend({ type: z.enum(notificationTypes).optional() });
export const updateSavedViewSchema = createUpdateSchema(savedViews).extend({ type: z.enum(savedViewTypes).optional() });
export const updateEmailTemplateSchema = createUpdateSchema(emailTemplates);
export const updateAuditLogSchema = createUpdateSchema(auditLogs).extend({
  action: z.enum(auditLogActions).optional(),
  entityType: z.enum(auditLogEntityTypes).optional(),
});
export const updateFileSchema = createUpdateSchema(files).extend({ entityType: z.enum(fileEntityTypes).optional() });
export const updateLeadScoreSchema = createUpdateSchema(leadScores).extend({ entityType: z.enum(leadScoreEntityTypes).optional() });
export const updateCalendarEventSchema = createUpdateSchema(calendarEvents).extend({
  type: z.enum(calendarEventTypes).nullable().optional(),
  syncSource: z.enum(calendarSyncSources).nullable().optional(),
});
export const updateChannelConfigSchema = createUpdateSchema(channelConfigs).extend({ type: z.enum(channelConfigTypes).optional() });
export const updatePushTokenSchema = createUpdateSchema(pushTokens);
export const updateGoogleOAuthTokenSchema = createUpdateSchema(googleOAuthTokens).extend({ syncStatus: z.enum(googleCalendarSyncStatuses).optional() });

// Select schemas (useful for validating API responses)
export const selectSessionSchema = createSelectSchema(sessions);
export const selectUserSchema = createSelectSchema(users).extend({ role: z.enum(userRoles).nullable() });
export const selectPasswordResetTokenSchema = createSelectSchema(passwordResetTokens);
export const selectOrganizationSchema = createSelectSchema(organizations);
export const selectCompanySchema = createSelectSchema(companies);
export const selectContactSchema = createSelectSchema(contacts);
export const selectPipelineSchema = createSelectSchema(pipelines);
export const selectPipelineStageSchema = createSelectSchema(pipelineStages);
export const selectDealSchema = createSelectSchema(deals);
export const selectConversationSchema = createSelectSchema(conversations).extend({ channel: z.enum(channelTypes), status: z.enum(conversationStatuses).nullable() });
export const selectMessageSchema = createSelectSchema(messages).extend({ contentType: z.enum(messageContentTypes).nullable() });
export const selectActivitySchema = createSelectSchema(activities).extend({ type: z.enum(activityTypes), status: z.enum(activityStatuses).nullable() });
export const selectNotificationSchema = createSelectSchema(notifications).extend({ type: z.enum(notificationTypes) });
export const selectSavedViewSchema = createSelectSchema(savedViews).extend({ type: z.enum(savedViewTypes) });
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates);
export const selectAuditLogSchema = createSelectSchema(auditLogs).extend({
  action: z.enum(auditLogActions),
  entityType: z.enum(auditLogEntityTypes),
});
export const selectFileSchema = createSelectSchema(files).extend({ entityType: z.enum(fileEntityTypes) });
export const selectLeadScoreSchema = createSelectSchema(leadScores).extend({ entityType: z.enum(leadScoreEntityTypes) });
export const selectCalendarEventSchema = createSelectSchema(calendarEvents).extend({
  type: z.enum(calendarEventTypes).nullable(),
  syncSource: z.enum(calendarSyncSources).nullable(),
});
export const selectChannelConfigSchema = createSelectSchema(channelConfigs).extend({ type: z.enum(channelConfigTypes) });
export const selectPushTokenSchema = createSelectSchema(pushTokens);
export const selectGoogleOAuthTokenSchema = createSelectSchema(googleOAuthTokens).extend({ syncStatus: z.enum(googleCalendarSyncStatuses).nullable() });

// Types - usamos z.infer para schemas com enum estendidos e $inferSelect para select types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;
export type SavedView = typeof savedViews.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;
export type LeadScore = typeof leadScores.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertChannelConfig = z.infer<typeof insertChannelConfigSchema>;
export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertGoogleOAuthToken = z.infer<typeof insertGoogleOAuthTokenSchema>;
export type GoogleOAuthToken = typeof googleOAuthTokens.$inferSelect;
export type InsertDeadLetterJob = z.infer<typeof insertDeadLetterJobSchema>;
export type DeadLetterJob = typeof deadLetterJobs.$inferSelect;

export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;
export type UpdatePipelineStage = z.infer<typeof updatePipelineStageSchema>;
export type UpdateDeal = z.infer<typeof updateDealSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type UpdateActivity = z.infer<typeof updateActivitySchema>;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;
export type UpdateSavedView = z.infer<typeof updateSavedViewSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;
export type UpdateAuditLog = z.infer<typeof updateAuditLogSchema>;
export type UpdateFile = z.infer<typeof updateFileSchema>;
export type UpdateLeadScore = z.infer<typeof updateLeadScoreSchema>;
export type UpdateCalendarEvent = z.infer<typeof updateCalendarEventSchema>;
export type UpdateChannelConfig = z.infer<typeof updateChannelConfigSchema>;
export type UpdatePushToken = z.infer<typeof updatePushTokenSchema>;
export type UpdateGoogleOAuthToken = z.infer<typeof updateGoogleOAuthTokenSchema>;

