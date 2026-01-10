/**
 * IMAP Email Synchronization
 * Uses imap and mailparser to fetch and parse emails
 */

import Imap from "imap";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { logger } from "../../logger";
import type { EmailConfig, ParsedEmail, EmailAddress, EmailAttachment, SyncResult } from "./types";

const IMAP_TIMEOUT = 30000; // 30 seconds
const MAX_EMAILS_PER_SYNC = 50;

/**
 * Convert mailparser AddressObject to our EmailAddress format
 */
function parseAddresses(addressObj: AddressObject | AddressObject[] | undefined): EmailAddress[] {
  if (!addressObj) return [];

  const addresses = Array.isArray(addressObj) ? addressObj : [addressObj];
  const result: EmailAddress[] = [];

  for (const addr of addresses) {
    if (addr.value) {
      for (const v of addr.value) {
        result.push({
          name: v.name || undefined,
          address: v.address || "",
        });
      }
    }
  }

  return result;
}

/**
 * Parse a raw email into our ParsedEmail format
 */
async function parseEmail(raw: Buffer): Promise<ParsedEmail> {
  const parsed: ParsedMail = await simpleParser(raw);

  const attachments: EmailAttachment[] = (parsed.attachments || []).map((att) => ({
    filename: att.filename || "attachment",
    contentType: att.contentType,
    size: att.size,
    content: att.content,
    contentId: att.contentId || undefined,
  }));

  // Extract headers into a Map
  const headers = new Map<string, string>();
  if (parsed.headers) {
    parsed.headers.forEach((value, key) => {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (value && typeof value === "object" && "value" in value) {
        headers.set(key, String((value as { value: unknown }).value));
      }
    });
  }

  return {
    messageId: parsed.messageId || `generated-${Date.now()}`,
    subject: parsed.subject || "(Sem assunto)",
    from: parseAddresses(parsed.from),
    to: parseAddresses(parsed.to),
    cc: parseAddresses(parsed.cc),
    date: parsed.date || new Date(),
    text: parsed.text || undefined,
    html: parsed.html || undefined,
    attachments,
    inReplyTo: parsed.inReplyTo || undefined,
    references: parsed.references
      ? Array.isArray(parsed.references)
        ? parsed.references
        : [parsed.references]
      : undefined,
    headers,
  };
}

/**
 * Create an IMAP connection
 */
function createImapConnection(config: EmailConfig): Imap {
  return new Imap({
    user: config.email,
    password: config.password,
    host: config.imapHost,
    port: config.imapPort,
    tls: config.imapSecure,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: IMAP_TIMEOUT,
    authTimeout: IMAP_TIMEOUT,
  });
}

/**
 * Verify IMAP connection
 */
export function verifyImapConnection(config: EmailConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const imap = createImapConnection(config);

    const cleanup = () => {
      try {
        imap.end();
      } catch {
        // Ignore cleanup errors
      }
    };

    imap.once("ready", () => {
      logger.info("[IMAP] Connection verified successfully", { email: config.email });
      cleanup();
      resolve(true);
    });

    imap.once("error", (err: Error) => {
      logger.error("[IMAP] Connection verification failed", {
        error: err.message,
        email: config.email,
      });
      cleanup();
      resolve(false);
    });

    imap.connect();
  });
}

/**
 * Fetch emails from INBOX since a given UID
 */
export function fetchEmails(
  config: EmailConfig,
  sinceUid?: number,
  limit: number = MAX_EMAILS_PER_SYNC
): Promise<{ emails: ParsedEmail[]; lastUid: number }> {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config);
    const emails: ParsedEmail[] = [];
    let lastUid = sinceUid || 0;

    const cleanup = () => {
      try {
        imap.end();
      } catch {
        // Ignore cleanup errors
      }
    };

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) {
          cleanup();
          reject(err);
          return;
        }

        if (box.messages.total === 0) {
          cleanup();
          resolve({ emails: [], lastUid });
          return;
        }

        // Build search criteria
        const searchCriteria = sinceUid && sinceUid > 0 ? [["UID", `${sinceUid + 1}:*`]] : ["ALL"];

        // Search for messages
        imap.search(searchCriteria as any, (searchErr, uids) => {
          if (searchErr) {
            cleanup();
            reject(searchErr);
            return;
          }

          if (!uids || uids.length === 0) {
            cleanup();
            resolve({ emails: [], lastUid });
            return;
          }

          // Sort UIDs descending and take the most recent ones
          const sortedUids = uids.sort((a, b) => b - a).slice(0, limit);

          // Track how many we've processed
          let pending = sortedUids.length;
          let hasError = false;

          const fetch = imap.fetch(sortedUids, { bodies: "", struct: true });

          fetch.on("message", (msg, seqno) => {
            let uid = 0;
            const chunks: Buffer[] = [];

            msg.on("body", (stream) => {
              stream.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
              });
            });

            msg.on("attributes", (attrs) => {
              uid = attrs.uid;
              if (uid > lastUid) {
                lastUid = uid;
              }
            });

            msg.once("end", async () => {
              if (hasError) return;

              try {
                const raw = Buffer.concat(chunks);
                const parsed = await parseEmail(raw);
                emails.push(parsed);
              } catch (parseErr) {
                logger.warn("[IMAP] Failed to parse email", {
                  seqno,
                  uid,
                  error: parseErr instanceof Error ? parseErr.message : String(parseErr),
                });
              }

              pending--;
              if (pending === 0) {
                cleanup();
                resolve({ emails, lastUid });
              }
            });
          });

          fetch.once("error", (fetchErr) => {
            hasError = true;
            cleanup();
            reject(fetchErr);
          });

          fetch.once("end", () => {
            // If there were no messages to fetch
            if (pending === 0) {
              cleanup();
              resolve({ emails, lastUid });
            }
          });
        });
      });
    });

    imap.once("error", (err: Error) => {
      logger.error("[IMAP] Connection error", {
        error: err.message,
        email: config.email,
      });
      cleanup();
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Sync emails and process them with a callback
 */
export async function syncEmails(
  config: EmailConfig,
  sinceUid: number | undefined,
  onEmail: (email: ParsedEmail) => Promise<void>
): Promise<SyncResult> {
  const result: SyncResult = {
    newEmails: 0,
    totalProcessed: 0,
    errors: [],
  };

  try {
    const { emails, lastUid } = await fetchEmails(config, sinceUid);
    result.lastUid = lastUid;

    for (const email of emails) {
      try {
        await onEmail(email);
        result.newEmails++;
        result.totalProcessed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to process ${email.messageId}: ${errorMsg}`);
        result.totalProcessed++;
      }
    }

    logger.info("[IMAP] Sync completed", {
      email: config.email,
      newEmails: result.newEmails,
      totalProcessed: result.totalProcessed,
      errors: result.errors.length,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Sync failed: ${errorMsg}`);
    logger.error("[IMAP] Sync failed", {
      email: config.email,
      error: errorMsg,
    });
  }

  return result;
}
