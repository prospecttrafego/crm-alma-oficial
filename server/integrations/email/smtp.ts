/**
 * SMTP Email Sending
 * Uses nodemailer to send emails via SMTP
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "../../logger";
import type { EmailConfig, SendEmailOptions, SendEmailResult } from "./types";

const SMTP_TIMEOUT = 30000; // 30 seconds

/**
 * Create a nodemailer transporter with the given config
 */
function createTransporter(config: EmailConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    connectionTimeout: SMTP_TIMEOUT,
    greetingTimeout: SMTP_TIMEOUT,
    socketTimeout: SMTP_TIMEOUT,
  });
}

/**
 * Verify SMTP connection
 */
export async function verifySmtpConnection(config: EmailConfig): Promise<boolean> {
  const transporter = createTransporter(config);

  try {
    await transporter.verify();
    logger.info("[SMTP] Connection verified successfully", { email: config.email });
    return true;
  } catch (error) {
    logger.error("[SMTP] Connection verification failed", {
      error: error instanceof Error ? error.message : String(error),
      email: config.email,
    });
    return false;
  } finally {
    transporter.close();
  }
}

/**
 * Send an email via SMTP
 */
export async function sendEmail(
  config: EmailConfig,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const transporter = createTransporter(config);
  const fromName = config.fromName || config.email.split("@")[0];

  try {
    const result = await transporter.sendMail({
      from: `"${fromName}" <${config.email}>`,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      cc: options.cc
        ? Array.isArray(options.cc)
          ? options.cc.join(", ")
          : options.cc
        : undefined,
      bcc: options.bcc
        ? Array.isArray(options.bcc)
          ? options.bcc.join(", ")
          : options.bcc
        : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
      inReplyTo: options.inReplyTo,
      references: options.references?.join(" "),
    });

    logger.info("[SMTP] Email sent successfully", {
      messageId: result.messageId,
      to: options.to,
      subject: options.subject,
    });

    return {
      messageId: result.messageId,
      accepted: result.accepted as string[],
      rejected: result.rejected as string[],
    };
  } catch (error) {
    logger.error("[SMTP] Failed to send email", {
      error: error instanceof Error ? error.message : String(error),
      to: options.to,
      subject: options.subject,
    });
    throw error;
  } finally {
    transporter.close();
  }
}

/**
 * Send a reply to an existing conversation
 */
export async function sendReply(
  config: EmailConfig,
  originalMessageId: string,
  originalReferences: string[],
  options: Omit<SendEmailOptions, "inReplyTo" | "references">
): Promise<SendEmailResult> {
  // Build references chain: original references + original message ID
  const references = [...originalReferences, originalMessageId];

  return sendEmail(config, {
    ...options,
    inReplyTo: originalMessageId,
    references,
  });
}
