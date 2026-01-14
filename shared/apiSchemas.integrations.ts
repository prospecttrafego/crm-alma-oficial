/**
 * Integration-specific API response schemas (runtime validation)
 */

import { z } from "zod";

export const channelConfigTestResultSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    imap: z.boolean().optional(),
    smtp: z.boolean().optional(),
  })
  .strict();
export type ChannelConfigTestResult = z.infer<typeof channelConfigTestResultSchema>;

export const whatsAppConnectResponseSchema = z
  .object({
    instanceName: z.string(),
    qrCode: z.string(),
    pairingCode: z.string().optional(),
    status: z.string(),
  })
  .strict();
export type WhatsAppConnectResponse = z.infer<typeof whatsAppConnectResponseSchema>;

export const whatsAppStatusResponseSchema = z
  .object({
    status: z.string(),
    instanceName: z.string().nullable(),
    lastConnectedAt: z.string().optional(),
  })
  .strict();
export type WhatsAppStatusResponse = z.infer<typeof whatsAppStatusResponseSchema>;

export const successMessageSchema = z.object({ success: z.boolean(), message: z.string() }).strict();
export type SuccessMessage = z.infer<typeof successMessageSchema>;

