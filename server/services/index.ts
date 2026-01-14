/**
 * Services Index
 * Re-exports all service modules
 */

export { processIncomingEmail } from "./email-ingest";
export {
  connectWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendWhatsAppMessage,
  buildInstanceName,
  type WhatsAppConnectionResult,
  type WhatsAppStatusResult,
  type WhatsAppSendResult,
} from "./whatsapp-config";

export {
  autoCreateDealForContact,
  type DealAutoCreationOptions,
  type DealAutoCreationResult,
} from "./deal-auto-creator";
