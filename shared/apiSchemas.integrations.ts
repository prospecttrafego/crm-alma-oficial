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
    // Pode ser omitido quando o backend já detecta a instância como conectada
    // e retorna apenas { status: "connected" }.
    qrCode: z.string().optional(),
    // NOTA: Evolution API retorna null quando não há pairing code.
    // Usando .nullish() para aceitar string | null | undefined.
    pairingCode: z.string().nullish(),
    status: z.string(),
    // NOTA: Usando .nullish() pois APIs externas podem retornar null.
    message: z.string().nullish(),
  })
  .strict();
export type WhatsAppConnectResponse = z.infer<typeof whatsAppConnectResponseSchema>;

export const whatsAppStatusResponseSchema = z
  .object({
    status: z.string(),
    instanceName: z.string().nullable(),
    lastConnectedAt: z.string().optional(),
    requiresReconnect: z.boolean().optional(),
    reconnectReason: z.string().optional(),
  })
  .strict();
export type WhatsAppStatusResponse = z.infer<typeof whatsAppStatusResponseSchema>;

export const successMessageSchema = z.object({ success: z.boolean(), message: z.string() }).strict();
export type SuccessMessage = z.infer<typeof successMessageSchema>;
