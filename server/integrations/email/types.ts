/**
 * Email Integration Types
 * Type definitions for IMAP/SMTP operations
 */

export interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  email: string;
  password: string;
  fromName?: string;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
  contentId?: string;
}

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: EmailAddress[];
  to: EmailAddress[];
  cc?: EmailAddress[];
  date: Date;
  text?: string;
  html?: string;
  attachments: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
  headers: Map<string, string>;
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  inReplyTo?: string;
  references?: string[];
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface SyncResult {
  newEmails: number;
  totalProcessed: number;
  errors: string[];
  lastUid?: number;
}
