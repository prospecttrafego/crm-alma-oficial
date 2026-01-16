import type { Deal, Company } from "@shared/schema";
import type { SafeUser } from "@shared/types";
import type { ContactWithCompany } from "@/lib/api/conversations";

type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * Replaces supported `{{variable}}` placeholders in a message/template string.
 *
 * Supported variables:
 * - `{{contact.firstName}}`, `{{contact.lastName}}`, `{{contact.email}}`, `{{contact.phone}}`, `{{contact.jobTitle}}`
 * - `{{deal.title}}`, `{{deal.value}}`
 * - `{{company.name}}`
 * - `{{user.firstName}}`, `{{user.lastName}}`
 */
export function substituteVariables(
  template: string,
  context: {
    contact?: ContactWithCompany | null;
    deal?: Deal | null;
    company?: Company | null;
    user?: SafeUser | null;
  }
): string {
  const { contact, deal, company, user } = context;

  return template
    .replace(/\{\{contact\.firstName\}\}/g, contact?.firstName || "")
    .replace(/\{\{contact\.lastName\}\}/g, contact?.lastName || "")
    .replace(/\{\{contact\.email\}\}/g, contact?.email || "")
    .replace(/\{\{contact\.phone\}\}/g, contact?.phone || "")
    .replace(/\{\{contact\.jobTitle\}\}/g, contact?.jobTitle || "")
    .replace(/\{\{deal\.title\}\}/g, deal?.title || "")
    .replace(/\{\{deal\.value\}\}/g, deal?.value ? Number(deal.value).toLocaleString("pt-BR") : "")
    .replace(/\{\{company\.name\}\}/g, company?.name || "")
    .replace(/\{\{user\.firstName\}\}/g, user?.firstName || "")
    .replace(/\{\{user\.lastName\}\}/g, user?.lastName || "");
}

/**
 * Formats a recording duration in `m:ss` for UI display.
 */
export function formatRecordingTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Returns a translation for `key`, falling back to `fallback` when the key is missing.
 */
export function getTranslatedValue(t: Translator, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

/**
 * Returns a localized label for an inbox channel (e.g. "email", "whatsapp").
 */
export function getChannelLabel(t: Translator, channel: string) {
  return getTranslatedValue(t, `inbox.channels.${channel}`, channel);
}

/**
 * Returns a localized label for an inbox status (e.g. "open", "closed").
 */
export function getStatusLabel(t: Translator, status: string) {
  return getTranslatedValue(t, `inbox.status.${status}`, status);
}

/**
 * Formats a timestamp for inbox list display (time for today, "yesterday", weekday, or short date).
 */
export function formatInboxTime(t: Translator, date: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) {
    return t("common.yesterday");
  }
  if (days < 7) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
