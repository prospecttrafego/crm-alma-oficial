/**
 * Evolution API Service
 * Handles WhatsApp integration via Evolution API (Baileys-based)
 * Documentation: https://doc.evolution-api.com/
 */

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
   * Make a request to Evolution API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Evolution API is not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Evolution API] Error: ${response.status} - ${error}`);
      throw new Error(`Evolution API error: ${response.status}`);
    }

    return response.json() as T;
  }

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(instanceName: string): Promise<EvolutionInstance> {
    console.log(`[Evolution API] Creating instance: ${instanceName}`);

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
    console.log(`[Evolution API] Getting QR code for: ${instanceName}`);

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
    console.log(`[Evolution API] Getting connection status for: ${instanceName}`);

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
      console.log(`[Evolution API] Getting instance info for: ${instanceName}`);

      const result = await this.request<EvolutionInstanceInfo>(
        'GET',
        `/instance/fetchInstances?instanceName=${instanceName}`
      );

      return result;
    } catch (error) {
      console.log(`[Evolution API] Instance not found: ${instanceName}`);
      return null;
    }
  }

  /**
   * Disconnect (logout) an instance
   */
  async disconnectInstance(instanceName: string): Promise<void> {
    console.log(`[Evolution API] Disconnecting instance: ${instanceName}`);

    await this.request<void>(
      'DELETE',
      `/instance/logout/${instanceName}`
    );
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceName: string): Promise<void> {
    console.log(`[Evolution API] Deleting instance: ${instanceName}`);

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
    console.log(`[Evolution API] Sending message to ${to} from ${instanceName}`);

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
    console.log(`[Evolution API] Sending ${mediaType} to ${to} from ${instanceName}`);

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
    console.log(`[Evolution API] Setting webhook for ${instanceName}: ${safeUrl}`);

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
