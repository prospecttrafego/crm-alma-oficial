/**
 * Data Transfer Objects - Request payloads for API mutations
 * These types define what the frontend should send to the backend
 */

import type {
  Contact,
  Company,
  Deal,
  Activity,
  Conversation,
  Message,
  Pipeline,
  PipelineStage,
  CalendarEvent,
  ChannelConfig,
  EmailTemplate,
  SavedView,
} from '../schema';

// ===== CONTACTS =====

export type CreateContactDTO = Pick<Contact, 'firstName'> &
  Partial<Pick<Contact,
    | 'lastName'
    | 'email'
    | 'phone'
    | 'jobTitle'
    | 'companyId'
    | 'tags'
    | 'source'
    | 'customFields'
  >>;

export type UpdateContactDTO = Partial<CreateContactDTO>;

// ===== COMPANIES =====

export type CreateCompanyDTO = Pick<Company, 'name'> &
  Partial<Pick<Company,
    | 'domain'
    | 'website'
    | 'segment'
    | 'size'
    | 'industry'
    | 'customFields'
  >>;

export type UpdateCompanyDTO = Partial<CreateCompanyDTO>;

// ===== DEALS =====

export type CreateDealDTO = Pick<Deal, 'title' | 'pipelineId' | 'stageId'> &
  Partial<Pick<Deal,
    | 'value'
    | 'currency'
    | 'contactId'
    | 'companyId'
    | 'probability'
    | 'expectedCloseDate'
    | 'notes'
    | 'source'
    | 'customFields'
  >>;

export type UpdateDealDTO = Partial<Omit<CreateDealDTO, 'pipelineId'>>;

export type MoveDealDTO = {
  stageId: number;
};

// ===== PIPELINES =====

export type CreatePipelineStageInlineDTO = Pick<PipelineStage, 'name' | 'order'> &
  Partial<Pick<PipelineStage, 'color' | 'isWon' | 'isLost'>>;

export type CreatePipelineDTO = Pick<Pipeline, 'name'> &
  Partial<Pick<Pipeline, 'isDefault'>> & {
    stages?: CreatePipelineStageInlineDTO[];
  };

export type UpdatePipelineDTO = Partial<Pick<Pipeline, 'name' | 'isDefault'>>;

export type CreatePipelineStageDTO = Pick<PipelineStage, 'name' | 'pipelineId' | 'order'> &
  Partial<Pick<PipelineStage, 'color' | 'isWon' | 'isLost'>>;

export type UpdatePipelineStageDTO = Partial<Pick<PipelineStage, 'name' | 'order' | 'color' | 'isWon' | 'isLost'>>;

// ===== CONVERSATIONS =====

export type CreateConversationDTO = Pick<Conversation, 'channel'> &
  Partial<Pick<Conversation, 'subject' | 'contactId' | 'dealId' | 'assignedToId'>>;

export type UpdateConversationDTO = Partial<Pick<Conversation, 'subject' | 'status' | 'assignedToId'>>;

// ===== MESSAGES =====

export type CreateMessageDTO = Pick<Message, 'content'> &
  Partial<Pick<Message, 'contentType' | 'isInternal' | 'attachments' | 'metadata' | 'mentions'>>;

// ===== ACTIVITIES =====

export type CreateActivityDTO = Pick<Activity, 'type' | 'title'> &
  Partial<Pick<Activity, 'description' | 'contactId' | 'dealId' | 'dueDate'>>;

export type UpdateActivityDTO = Partial<CreateActivityDTO & Pick<Activity, 'status' | 'completedAt'>>;

// ===== CALENDAR EVENTS =====

export type CreateCalendarEventDTO = Pick<CalendarEvent, 'title' | 'startTime' | 'endTime'> &
  Partial<Pick<CalendarEvent,
    | 'description'
    | 'location'
    | 'type'
    | 'contactId'
    | 'dealId'
    | 'allDay'
    | 'attendees'
  >>;

export type UpdateCalendarEventDTO = Partial<CreateCalendarEventDTO>;

// ===== CHANNEL CONFIGS =====

export type CreateChannelConfigDTO = Pick<ChannelConfig, 'name' | 'type'> &
  Partial<Pick<ChannelConfig, 'isActive' | 'emailConfig' | 'whatsappConfig'>>;

export type UpdateChannelConfigDTO = Partial<Omit<CreateChannelConfigDTO, 'type'>>;

// ===== EMAIL TEMPLATES =====

export type CreateEmailTemplateDTO = Pick<EmailTemplate, 'name' | 'subject' | 'body'> &
  Partial<Pick<EmailTemplate, 'variables'>>;

export type UpdateEmailTemplateDTO = Partial<CreateEmailTemplateDTO>;

// ===== SAVED VIEWS =====

export type CreateSavedViewDTO = Pick<SavedView, 'name' | 'type' | 'filters'> &
  Partial<Pick<SavedView, 'isDefault'>>;

export type UpdateSavedViewDTO = Partial<Pick<SavedView, 'name' | 'filters' | 'isDefault'>>;
