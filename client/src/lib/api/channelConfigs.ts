/**
 * Channel Configs API - CRUD operations for channel configurations
 */

import { api } from "./client";
import {
  channelConfigPublicSchema,
  whatsAppConnectResponseSchema,
  whatsAppStatusResponseSchema,
  channelConfigTestResultSchema,
  successMessageSchema,
} from "@shared/apiSchemas";
import type { CreateChannelConfigDTO, UpdateChannelConfigDTO } from '@shared/types';
import type { ChannelConfigPublic, SuccessMessage, WhatsAppConnectResponse, WhatsAppStatusResponse, ChannelConfigTestResult } from "@shared/types";
import { z } from "zod";

export const channelConfigsApi = {
  /**
   * List all channel configs
   */
  list: () => api.get<ChannelConfigPublic[]>('/api/channel-configs', z.array(channelConfigPublicSchema)),

  /**
   * Create a new channel config
   */
  create: (data: CreateChannelConfigDTO) =>
    api.post<ChannelConfigPublic>('/api/channel-configs', data, channelConfigPublicSchema),

  /**
   * Update an existing channel config
   */
  update: (id: number, data: UpdateChannelConfigDTO) =>
    api.patch<ChannelConfigPublic>(`/api/channel-configs/${id}`, data, channelConfigPublicSchema),

  /**
   * Delete a channel config
   */
  delete: (id: number) => api.delete<void>(`/api/channel-configs/${id}`),

  // ===== WHATSAPP =====

  /**
   * Connect WhatsApp (get QR code)
   */
  connectWhatsApp: (id: number) =>
    api.post<WhatsAppConnectResponse>(
      `/api/channel-configs/${id}/whatsapp/connect`,
      {},
      whatsAppConnectResponseSchema
    ),

  /**
   * Get WhatsApp connection status
   */
  getWhatsAppStatus: (id: number) =>
    api.get<WhatsAppStatusResponse>(
      `/api/channel-configs/${id}/whatsapp/status`,
      whatsAppStatusResponseSchema
    ),

  /**
   * Disconnect WhatsApp
   */
  disconnectWhatsApp: (id: number) =>
    api.post<SuccessMessage>(`/api/channel-configs/${id}/whatsapp/disconnect`, {}, successMessageSchema),

  /**
   * Test a channel configuration
   */
  testConnection: (id: number) =>
    api.post<ChannelConfigTestResult>(`/api/channel-configs/${id}/test`, {}, channelConfigTestResultSchema),
};
