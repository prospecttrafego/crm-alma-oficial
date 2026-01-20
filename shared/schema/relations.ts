import { relations } from "drizzle-orm";
import { users } from "./tables/auth";
import { organizations } from "./tables/organizations";
import { companies } from "./tables/companies";
import { contacts } from "./tables/contacts";
import { pipelines, pipelineStages, deals } from "./tables/pipelines";
import { conversations, messages } from "./tables/inbox";
import { activities } from "./tables/activities";
import { notifications, savedViews, emailTemplates } from "./tables/views";
import { auditLogs } from "./tables/auditLogs";
import { files } from "./tables/files";
import { leadScores } from "./tables/leadScores";
import { calendarEvents, googleOAuthTokens } from "./tables/calendar";
import { channelConfigs } from "./tables/channelConfigs";

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  ownedContacts: many(contacts),
  ownedDeals: many(deals),
  activities: many(activities),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  companies: many(companies),
  contacts: many(contacts),
  pipelines: many(pipelines),
  deals: many(deals),
  conversations: many(conversations),
  activities: many(activities),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [companies.ownerId],
    references: [users.id],
  }),
  contacts: many(contacts),
  deals: many(deals),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [contacts.ownerId],
    references: [users.id],
  }),
  deals: many(deals),
  conversations: many(conversations),
  activities: many(activities),
}));

export const pipelinesRelations = relations(pipelines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pipelines.organizationId],
    references: [organizations.id],
  }),
  stages: many(pipelineStages),
  deals: many(deals),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineStages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  stage: one(pipelineStages, {
    fields: [deals.stageId],
    references: [pipelineStages.id],
  }),
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [deals.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [deals.ownerId],
    references: [users.id],
  }),
  conversations: many(conversations),
  activities: many(activities),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [conversations.dealId],
    references: [deals.id],
  }),
  organization: one(organizations, {
    fields: [conversations.organizationId],
    references: [organizations.id],
  }),
  assignedTo: one(users, {
    fields: [conversations.assignedToId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [activities.dealId],
    references: [deals.id],
  }),
  organization: one(organizations, {
    fields: [activities.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const savedViewsRelations = relations(savedViews, ({ one }) => ({
  user: one(users, {
    fields: [savedViews.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [savedViews.organizationId],
    references: [organizations.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailTemplates.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  organization: one(organizations, {
    fields: [files.organizationId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
}));

export const leadScoresRelations = relations(leadScores, ({ one }) => ({
  organization: one(organizations, {
    fields: [leadScores.organizationId],
    references: [organizations.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [calendarEvents.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [calendarEvents.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [calendarEvents.dealId],
    references: [deals.id],
  }),
  activity: one(activities, {
    fields: [calendarEvents.activityId],
    references: [activities.id],
  }),
}));

export const channelConfigsRelations = relations(channelConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [channelConfigs.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [channelConfigs.createdBy],
    references: [users.id],
  }),
}));

export const googleOAuthTokensRelations = relations(googleOAuthTokens, ({ one }) => ({
  user: one(users, {
    fields: [googleOAuthTokens.userId],
    references: [users.id],
  }),
}));
