/**
 * Evolution API Service
 * Handles WhatsApp integration via Evolution API (Baileys-based)
 * Documentation: https://doc.evolution-api.com/
 */

import { whatsappLogger } from '../../logger';
import { withRetry } from '../../retry';

// Timeout padrao para chamadas externas (30 segundos)
const DEFAULT_TIMEOUT_MS = 30000;

// Retry options for Evolution API calls
const RETRY_OPTIONS = {
  maxRetries: 2,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  label: 'Evolution API',
};

export interface EvolutionInstance {
  instanceName: string;
  instanceId?: string;
  status?: string;
  owner?: string;
}

export interface EvolutionQRCode {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

export interface EvolutionConnectionState {
  instance: string;
  state: 'open' | 'close' | 'connecting';
}

export interface EvolutionInstanceInfo {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
    serverUrl: string;
    apikey: string;
    owner: string;
  };
}

export class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
  }

  /**
   * Check if Evolution API is configured
   */
  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey);
  }

  /**
   * Get the base configuration status
   */
  getConfiguration(): { url: string; configured: boolean } {
    return {
      url: this.baseUrl,
      configured: this.isConfigured(),
    };
  }

  /**
   * Make a request to Evolution API with timeout and retry
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Evolution API is not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;

    return withRetry(async () => {
      const start = Date.now();

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, options);
        const duration = Date.now() - start;

        if (!response.ok) {
          const errorText = await response.text();
          // 5xx errors are retryable, 4xx errors are not (except 429)
          const isRetryable = response.status >= 500 || response.status === 429;
          whatsappLogger.error(`Evolution API error: ${response.status}`, {
            endpoint,
            statusCode: response.status,
            error: errorText,
            duration,
            retryable: isRetryable,
          });
          const err = new Error(`Evolution API error: ${response.status}`);
          (err as any).statusCode = response.status;
          (err as any).retryable = isRetryable;
          throw err;
        }

        whatsappLogger.info(`Evolution API ${method} ${endpoint}`, {
          statusCode: response.status,
          duration,
        });

        return response.json() as T;
      } catch (error) {
        const duration = Date.now() - start;
        if (error instanceof Error && error.name === 'TimeoutError') {
          whatsappLogger.error(`Evolution API timeout: ${endpoint}`, {
            endpoint,
            timeout: timeoutMs,
            duration,
          });
          throw new Error(`Evolution API timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
    }, {
      ...RETRY_OPTIONS,
      isRetryable: (error) => {
        // Only retry on network errors, timeouts, 5xx errors, or 429
        if (error instanceof Error) {
          if ((error as any).retryable === false) return false;
          if ((error as any).retryable === true) return true;
          const msg = error.message.toLowerCase();
          return msg.includes('timeout') || msg.includes('network') || msg.includes('fetch failed');
        }
        return true;
      },
    });
  }

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(instanceName: string): Promise<EvolutionInstance> {
    whatsappLogger.info(`[Evolution API] Creating instance: ${instanceName}`);

    const result = await this.request<{ instance: EvolutionInstance }>(
      'POST',
      '/instance/create',
      {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }
    );

    return result.instance;
  }

  /**
   * Get QR code for an instance
   */
  async getQrCode(instanceName: string): Promise<EvolutionQRCode> {
    whatsappLogger.info(`[Evolution API] Getting QR code for: ${instanceName}`);

    const result = await this.request<EvolutionQRCode>(
      'GET',
      `/instance/connect/${instanceName}`
    );

    return result;
  }

  /**
   * Get connection status for an instance
   */
  async getConnectionStatus(instanceName: string): Promise<EvolutionConnectionState> {
    whatsappLogger.info(`[Evolution API] Getting connection status for: ${instanceName}`);

    const result = await this.request<EvolutionConnectionState>(
      'GET',
      `/instance/connectionState/${instanceName}`
    );

    return result;
  }

  /**
   * Get instance info
   */
  async getInstanceInfo(instanceName: string): Promise<EvolutionInstanceInfo | null> {
    try {
      whatsappLogger.info(`[Evolution API] Getting instance info for: ${instanceName}`);

      const result = await this.request<EvolutionInstanceInfo>(
        'GET',
        `/instance/fetchInstances?instanceName=${instanceName}`
      );

      return result;
    } catch (_error) {
      whatsappLogger.info(`[Evolution API] Instance not found: ${instanceName}`);
      return null;
    }
  }

  /**
   * Disconnect (logout) an instance
   */
  async disconnectInstance(instanceName: string): Promise<void> {
    whatsappLogger.info(`[Evolution API] Disconnecting instance: ${instanceName}`);

    await this.request<void>(
      'DELETE',
      `/instance/logout/${instanceName}`
    );
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceName: string): Promise<void> {
    whatsappLogger.info(`[Evolution API] Deleting instance: ${instanceName}`);

    await this.request<void>(
      'DELETE',
      `/instance/delete/${instanceName}`
    );
  }

  /**
   * Send a text message
   */
  async sendTextMessage(
    instanceName: string,
    to: string,
    text: string
  ): Promise<unknown> {
    whatsappLogger.info(`[Evolution API] Sending message to ${to} from ${instanceName}`);

    // Normalize phone number (remove non-digits except +)
    const normalizedTo = to.replace(/[^\d+]/g, '');

    const result = await this.request<unknown>(
      'POST',
      `/message/sendText/${instanceName}`,
      {
        number: normalizedTo,
        text,
      }
    );

    return result;
  }

  /**
   * Send a media message
   */
  async sendMediaMessage(
    instanceName: string,
    to: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
    fileName?: string
  ): Promise<unknown> {
    whatsappLogger.info(`[Evolution API] Sending ${mediaType} to ${to} from ${instanceName}`);

    const normalizedTo = to.replace(/[^\d+]/g, '');

    const result = await this.request<unknown>(
      'POST',
      `/message/sendMedia/${instanceName}`,
      {
        number: normalizedTo,
        mediatype: mediaType,
        media: mediaUrl,
        caption,
        fileName,
      }
    );

    return result;
  }

  /**
   * Set webhook URL for an instance
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    let safeUrl = webhookUrl;
    try {
      const parsed = new URL(webhookUrl);
      safeUrl = `${parsed.origin}${parsed.pathname}`;
    } catch {
      // ignore
    }
    whatsappLogger.info(`[Evolution API] Setting webhook for ${instanceName}: ${safeUrl}`);

    await this.request<void>(
      'POST',
      `/webhook/set/${instanceName}`,
      {
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      }
    );
  }
}

// Singleton instance
export const evolutionApi = new EvolutionApiService();
