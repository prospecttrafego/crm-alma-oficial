/**
 * Evolution API Message Handler
 * Processes incoming webhook events from Evolution API
 */

import { storage } from './storage';
import type { WebSocket } from 'ws';
import { whatsappLogger } from './logger';

// Evolution API webhook event types
export interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: unknown;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

export interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      url?: string;
      mimetype?: string;
      caption?: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      ptt?: boolean;
    };
    videoMessage?: {
      url?: string;
      mimetype?: string;
      caption?: string;
    };
    documentMessage?: {
      url?: string;
      mimetype?: string;
      fileName?: string;
    };
  };
  messageType?: string;
  messageTimestamp?: number;
}

export interface EvolutionConnectionUpdate {
  state: 'open' | 'close' | 'connecting';
  statusReason?: number;
}

export interface EvolutionQRCodeUpdate {
  code?: string;
  base64?: string;
}

// WebSocket broadcast function type
type BroadcastFn = (organizationId: number, event: string, data: unknown) => void;

export class EvolutionMessageHandler {
  private broadcast: BroadcastFn | null = null;

  /**
   * Set the broadcast function for WebSocket notifications
   */
  setBroadcast(fn: BroadcastFn) {
    this.broadcast = fn;
  }

  /**
   * Handle incoming webhook event
   */
  async handleWebhook(
    event: EvolutionWebhookEvent,
    channelConfigId: number,
    organizationId: number
  ): Promise<void> {
    const normalizedEvent = String(event.event || "").toUpperCase().replace(/\./g, "_");
    whatsappLogger.info(`[Evolution Handler] Received event: ${normalizedEvent} for instance: ${event.instance}`);

    switch (normalizedEvent) {
      case 'MESSAGES_UPSERT':
        await this.handleMessagesUpsert(event, channelConfigId, organizationId);
        break;

      case 'CONNECTION_UPDATE':
        await this.handleConnectionUpdate(event, channelConfigId, organizationId);
        break;

      case 'QRCODE_UPDATED':
        await this.handleQRCodeUpdate(event, channelConfigId, organizationId);
        break;

      default:
        whatsappLogger.info(`[Evolution Handler] Unhandled event: ${event.event}`);
    }
  }

  /**
   * Handle incoming messages
   */
  private async handleMessagesUpsert(
    event: EvolutionWebhookEvent,
    channelConfigId: number,
    organizationId: number
  ): Promise<void> {
    const payload = event.data as unknown as
      | EvolutionMessage[]
      | { messages?: EvolutionMessage[] }
      | null
      | undefined;

    const messages = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.messages)
        ? payload.messages
        : null;

    if (!messages) return;

    for (const msg of messages) {
      // Skip messages from self
      if (msg.key.fromMe) continue;

      // Extract phone number from remoteJid (format: 5511999999999@s.whatsapp.net)
      const phoneNumber = msg.key.remoteJid?.split('@')[0];
      if (!phoneNumber) continue;

      // Get message content
      const content = this.extractMessageContent(msg);
      if (!content) continue;

      const contentType = this.getContentType(msg);
      const senderName = msg.pushName || phoneNumber;

      whatsappLogger.info(`[Evolution Handler] New message from ${phoneNumber}: ${content.substring(0, 50)}...`);

      try {
        // Find or create contact by phone number (optimized: direct DB query)
        let contact = await storage.getContactByPhone(phoneNumber, organizationId);

        if (!contact) {
          // Create new contact
          contact = await storage.createContact({
            firstName: senderName || 'WhatsApp',
            lastName: '',
            phone: phoneNumber,
            organizationId,
            source: 'whatsapp',
          });
          whatsappLogger.info(`[Evolution Handler] Created new contact: ${contact.id}`);
        }

        // Find or create conversation (optimized: direct DB query)
        let conversation = await storage.getConversationByContactAndChannel(contact.id, 'whatsapp', organizationId);

        if (!conversation) {
          // Create new conversation
          conversation = await storage.createConversation({
            subject: `WhatsApp - ${senderName || phoneNumber}`,
            channel: 'whatsapp',
            status: 'open',
            contactId: contact.id,
            organizationId,
          });
          whatsappLogger.info(`[Evolution Handler] Created new conversation: ${conversation.id}`);
        } else if (conversation.status === 'closed') {
          // Reopen conversation
          await storage.updateConversation(conversation.id, { status: 'open' });
        }

        // Create message
        const message = await storage.createMessage({
          conversationId: conversation.id,
          senderId: null,
          senderType: 'contact',
          content,
          contentType,
          isInternal: false,
        });

        whatsappLogger.info(`[Evolution Handler] Created message: ${message.id}`);

        // Broadcast to connected clients
        if (this.broadcast) {
          this.broadcast(organizationId, 'new_message', {
            conversationId: conversation.id,
            message,
            contact,
          });
        }
      } catch (error) {
        whatsappLogger.error('[Evolution Handler] Error processing message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Handle connection status updates
   */
  private async handleConnectionUpdate(
    event: EvolutionWebhookEvent,
    channelConfigId: number,
    organizationId: number
  ): Promise<void> {
    const data = event.data as EvolutionConnectionUpdate;

    const statusMap: Record<string, string> = {
      'open': 'connected',
      'close': 'disconnected',
      'connecting': 'connecting',
    };

    const connectionStatus = statusMap[data.state] || 'disconnected';

    whatsappLogger.info(`[Evolution Handler] Connection update: ${data.state} -> ${connectionStatus}`);

    try {
      // Update channel config with new status
      const config = await storage.getChannelConfig(channelConfigId);
      if (config) {
        const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
        whatsappConfig.connectionStatus = connectionStatus;

        if (data.state === 'open') {
          whatsappConfig.lastConnectedAt = new Date().toISOString();
          whatsappConfig.qrCode = undefined; // Clear QR code on connect
        }

        await storage.updateChannelConfig(channelConfigId, {
          whatsappConfig: whatsappConfig as any,
        });
      }

      // Broadcast status update
      if (this.broadcast) {
        this.broadcast(organizationId, 'whatsapp_status', {
          channelConfigId,
          status: connectionStatus,
        });
      }
    } catch (error) {
      whatsappLogger.error('[Evolution Handler] Error updating connection status', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle QR code updates
   */
  private async handleQRCodeUpdate(
    event: EvolutionWebhookEvent,
    channelConfigId: number,
    organizationId: number
  ): Promise<void> {
    const data = event.data as EvolutionQRCodeUpdate;

    whatsappLogger.info(`[Evolution Handler] QR code updated for channel ${channelConfigId}`);

    try {
      // Update channel config with new QR code
      const config = await storage.getChannelConfig(channelConfigId);
      if (config) {
        const whatsappConfig = (config.whatsappConfig || {}) as Record<string, unknown>;
        whatsappConfig.qrCode = data.base64 || data.code;
        whatsappConfig.connectionStatus = 'qr_pending';

        await storage.updateChannelConfig(channelConfigId, {
          whatsappConfig: whatsappConfig as any,
        });
      }

      // Broadcast QR code update
      if (this.broadcast) {
        this.broadcast(organizationId, 'whatsapp_qr', {
          channelConfigId,
          qrCode: data.base64 || data.code,
        });
      }
    } catch (error) {
      whatsappLogger.error('[Evolution Handler] Error updating QR code', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extract message content from Evolution message
   */
  private extractMessageContent(msg: EvolutionMessage): string | null {
    if (!msg.message) return null;

    if (msg.message.conversation) {
      return msg.message.conversation;
    }

    if (msg.message.extendedTextMessage?.text) {
      return msg.message.extendedTextMessage.text;
    }

    if (msg.message.imageMessage?.caption) {
      return msg.message.imageMessage.caption;
    }

    if (msg.message.videoMessage?.caption) {
      return msg.message.videoMessage.caption;
    }

    // For media without caption, return placeholder
    if (msg.message.imageMessage) return '[Imagem]';
    if (msg.message.audioMessage) return '[Audio]';
    if (msg.message.videoMessage) return '[Video]';
    if (msg.message.documentMessage) return `[Documento: ${msg.message.documentMessage.fileName || 'arquivo'}]`;

    return null;
  }

  /**
   * Get content type from message
   */
  private getContentType(msg: EvolutionMessage): 'text' | 'audio' | 'image' | 'video' | 'file' {
    if (!msg.message) return 'text';

    if (msg.message.imageMessage) return 'image';
    if (msg.message.audioMessage) return 'audio';
    if (msg.message.videoMessage) return 'video';
    if (msg.message.documentMessage) return 'file';

    return 'text';
  }

}

// Singleton instance
export const evolutionHandler = new EvolutionMessageHandler();
