/**
 * Channel Configs API - CRUD operations for channel configurations
 */

import { api } from './index';
import type { ChannelConfig } from '@shared/schema';
import type { CreateChannelConfigDTO, UpdateChannelConfigDTO } from '@shared/types';

export type WhatsAppConnectResponse = {
  instanceName: string;
  qrCode: string;
  pairingCode?: string;
  status: string;
};

export type WhatsAppStatusResponse = {
  status: string;
  instanceName: string | null;
  lastConnectedAt?: string;
};

export type ChannelConfigTestResult = {
  success: boolean;
  message?: string;
  imap?: boolean;
  smtp?: boolean;
};

export const channelConfigsApi = {
  /**
   * List all channel configs
   */
  list: () => api.get<ChannelConfig[]>('/api/channel-configs'),

  /**
   * Get a single channel config by ID
   */
  get: (id: number) => api.get<ChannelConfig>(`/api/channel-configs/${id}`),

  /**
   * Create a new channel config
   */
  create: (data: CreateChannelConfigDTO) =>
    api.post<ChannelConfig>('/api/channel-configs', data),

  /**
   * Update an existing channel config
   */
  update: (id: number, data: UpdateChannelConfigDTO) =>
    api.patch<ChannelConfig>(`/api/channel-configs/${id}`, data),

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
      {}
    ),

  /**
   * Get WhatsApp connection status
   */
  getWhatsAppStatus: (id: number) =>
    api.get<WhatsAppStatusResponse>(
      `/api/channel-configs/${id}/whatsapp/status`
    ),

  /**
   * Disconnect WhatsApp
   */
  disconnectWhatsApp: (id: number) =>
    api.post<void>(`/api/channel-configs/${id}/whatsapp/disconnect`, {}),

  /**
   * Test a channel configuration
   */
  testConnection: (id: number) =>
    api.post<ChannelConfigTestResult>(`/api/channel-configs/${id}/test`, {}),

  // ===== EMAIL =====

  /**
   * Sync email inbox
   */
  syncEmail: (id: number) =>
    api.post<{ synced: number }>(`/api/channel-configs/${id}/email/sync`, {}),
};
