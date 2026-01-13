/**
 * Response payload types shared between backend and frontend.
 *
 * Canonical definitions live in `shared/apiSchemas.ts` as Zod schemas, which
 * also guarantees runtime validation can be enforced at the API boundary.
 */

export type {
  SafeUser,
  ContactWithCompany,
  ConversationWithRelations,
  MessageWithSender,
  MessagesResponse,
  GoogleCalendarConfigured,
  GoogleCalendarStatus,
  GoogleCalendarAuth,
  GoogleCalendarSyncResult,
  DashboardStats,
  ReportData,
  ChannelConfigPublic,
  PipelineWithStages,
  TranscriptionResult,
  ChannelConfigTestResult,
  WhatsAppConnectResponse,
  WhatsAppStatusResponse,
  SuccessMessage,
  EnrichedAuditLog,
} from "../apiSchemas";
