export const userRoles = ["admin", "sales", "cs", "support"] as const;
export type UserRole = (typeof userRoles)[number];

export type UserPreferences = {
  language?: "pt-BR" | "en";
};

export const channelTypes = ["email", "whatsapp", "sms", "internal", "phone"] as const;
export type ChannelType = (typeof channelTypes)[number];

export const conversationStatuses = ["open", "closed", "pending"] as const;
export type ConversationStatus = (typeof conversationStatuses)[number];

export const messageContentTypes = ["text", "audio", "image", "file", "video"] as const;
export type MessageContentType = (typeof messageContentTypes)[number];

export const activityTypes = ["call", "email", "meeting", "note", "task"] as const;
export type ActivityType = (typeof activityTypes)[number];

export const activityStatuses = ["pending", "completed", "cancelled"] as const;
export type ActivityStatus = (typeof activityStatuses)[number];

export const savedViewTypes = ["pipeline", "inbox", "contacts", "companies", "deals", "activities", "auditLog"] as const;
export type SavedViewType = (typeof savedViewTypes)[number];

export const notificationTypes = [
  "new_message",
  "deal_moved",
  "deal_won",
  "deal_lost",
  "task_due",
  "mention",
  "activity_assigned",
  "conversation_assigned",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export const auditLogActions = ["create", "update", "delete", "lgpd_export", "lgpd_delete"] as const;
export type AuditLogAction = (typeof auditLogActions)[number];

export const auditLogEntityTypes = ["deal", "contact", "company", "conversation", "activity", "pipeline", "email_template", "file", "integration"] as const;
export type AuditLogEntityType = (typeof auditLogEntityTypes)[number];

export const fileEntityTypes = ["message", "activity", "deal", "contact"] as const;
export type FileEntityType = (typeof fileEntityTypes)[number];

export const leadScoreEntityTypes = ["contact", "deal"] as const;
export type LeadScoreEntityType = (typeof leadScoreEntityTypes)[number];

export const calendarEventTypes = ["meeting", "call", "task", "reminder", "other"] as const;
export type CalendarEventType = (typeof calendarEventTypes)[number];

export const channelConfigTypes = ["email", "whatsapp"] as const;
export type ChannelConfigType = (typeof channelConfigTypes)[number];

export const whatsappConnectionStatuses = ["disconnected", "connecting", "connected", "qr_pending"] as const;
export type WhatsAppConnectionStatus = (typeof whatsappConnectionStatuses)[number];

export type WhatsAppConfig = {
  // Evolution API fields
  instanceName?: string;
  connectionStatus?: WhatsAppConnectionStatus;
  qrCode?: string;
  phoneNumber?: string;
  lastConnectedAt?: string;
  // Webhook auth markers (Evolution v2.x: headers are set at instance creation)
  webhookAuthMode?: "authorization";
  webhookAuthConfiguredAt?: string;
  // Legacy Meta Cloud API fields (backward compatibility)
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
};

export const calendarSyncSources = ["local", "google"] as const;
export type CalendarSyncSource = (typeof calendarSyncSources)[number];

export const googleCalendarSyncStatuses = ["idle", "syncing", "error"] as const;
export type GoogleCalendarSyncStatus = (typeof googleCalendarSyncStatuses)[number];

