/**
 * Offline Sync Utilities
 *
 * Coordinates offline queue sync with WebSocket reconnection.
 * Provides event emitters and status tracking for UI components.
 */

import {
  getQueuedMessages,
  updateOfflineMessageStatus,
  removeOfflineMessage,
  hasOfflineMessages,
  type OfflineMessage,
} from "./offlineDb";
import { conversationsApi } from "@/lib/api/conversations";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "completed" | "failed";

export interface SyncResult {
  success: number;
  failed: number;
  total: number;
}

type SyncEventType = "sync:start" | "sync:progress" | "sync:complete" | "sync:error" | "message:synced";

interface SyncEventData {
  "sync:start": { total: number };
  "sync:progress": { current: number; total: number; messageId: string };
  "sync:complete": SyncResult;
  "sync:error": { error: Error };
  "message:synced": { offlineId: string; serverId: number; conversationId: number };
}

type SyncEventCallback<T extends SyncEventType> = (data: SyncEventData[T]) => void;

// -----------------------------------------------------------------------------
// Event Emitter for Sync Events
// -----------------------------------------------------------------------------

class SyncEventEmitter {
  private listeners: Map<SyncEventType, Set<SyncEventCallback<SyncEventType>>> = new Map();

  on<T extends SyncEventType>(event: T, callback: SyncEventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as SyncEventCallback<SyncEventType>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as SyncEventCallback<SyncEventType>);
    };
  }

  emit<T extends SyncEventType>(event: T, data: SyncEventData[T]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }
}

export const syncEvents = new SyncEventEmitter();

// -----------------------------------------------------------------------------
// Sync State
// -----------------------------------------------------------------------------

let syncStatus: SyncStatus = "idle";
let syncInProgress = false;

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

// -----------------------------------------------------------------------------
// Main Sync Function
// -----------------------------------------------------------------------------

export interface SyncOptions {
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Synchronize all queued messages to the server
 *
 * Called automatically when:
 * 1. WebSocket reconnects
 * 2. Browser comes back online
 * 3. User manually triggers sync
 */
export async function syncOfflineMessages(options: SyncOptions = {}): Promise<SyncResult> {
  const { maxRetries = 3, onProgress } = options;

  // Prevent concurrent syncs
  if (syncInProgress) {
    console.log("[OfflineSync] Sync already in progress, skipping");
    return { success: 0, failed: 0, total: 0 };
  }

  // Check if there's anything to sync
  const hasMessages = await hasOfflineMessages();
  if (!hasMessages) {
    return { success: 0, failed: 0, total: 0 };
  }

  syncInProgress = true;
  syncStatus = "syncing";

  const queuedMessages = await getQueuedMessages();
  const total = queuedMessages.length;

  syncEvents.emit("sync:start", { total });

  let success = 0;
  let failed = 0;

  for (let i = 0; i < queuedMessages.length; i++) {
    const msg = queuedMessages[i];

    // Report progress
    onProgress?.(i + 1, total);
    syncEvents.emit("sync:progress", { current: i + 1, total, messageId: msg.id });

    // Skip if exceeded max retries
    if (msg.retryCount >= maxRetries) {
      console.warn(`[OfflineSync] Message ${msg.id} exceeded max retries`);
      await updateOfflineMessageStatus(msg.id, "failed", "Max retries exceeded");
      failed++;
      continue;
    }

    try {
      // Mark as syncing
      await updateOfflineMessageStatus(msg.id, "syncing");

      // Send to server
      const serverMessage = await conversationsApi.sendMessage(msg.conversationId, {
        content: msg.content,
        isInternal: msg.isInternal,
        replyToId: msg.replyToId ?? undefined,
        externalId: msg.id, // Use offline ID for idempotency
      });

      // Success - remove from queue
      await removeOfflineMessage(msg.id);
      success++;

      syncEvents.emit("message:synced", {
        offlineId: msg.id,
        serverId: serverMessage.id,
        conversationId: msg.conversationId,
      });
    } catch (error) {
      // Failed - mark for retry
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await updateOfflineMessageStatus(msg.id, "queued", errorMessage);
      failed++;

      console.error(`[OfflineSync] Failed to sync message ${msg.id}:`, error);
    }
  }

  const result: SyncResult = { success, failed, total };

  syncInProgress = false;
  syncStatus = failed > 0 ? "failed" : "completed";

  syncEvents.emit("sync:complete", result);

  // Reset status after a short delay
  setTimeout(() => {
    syncStatus = "idle";
  }, 3000);

  return result;
}

// -----------------------------------------------------------------------------
// WebSocket Integration Helper
// -----------------------------------------------------------------------------

/**
 * Called when WebSocket reconnects
 * Triggers sync of queued messages
 */
export async function onWebSocketReconnect(): Promise<void> {
  console.log("[OfflineSync] WebSocket reconnected, checking for queued messages");

  // Small delay to let connection stabilize
  await new Promise((resolve) => setTimeout(resolve, 500));

  const hasMessages = await hasOfflineMessages();
  if (hasMessages) {
    console.log("[OfflineSync] Found queued messages, starting sync");
    await syncOfflineMessages();
  }
}

// -----------------------------------------------------------------------------
// Convert offline message to optimistic message format
// -----------------------------------------------------------------------------

export function offlineMessageToOptimistic(
  msg: OfflineMessage,
  userId: string
): {
  id: number;
  conversationId: number;
  senderId: string;
  senderType: "user";
  content: string;
  contentType: "text";
  isInternal: boolean;
  attachments: null;
  metadata: null;
  mentions: null;
  readBy: string[];
  externalId: null;
  replyToId: number | null;
  createdAt: Date;
  editedAt: null;
  deletedAt: null;
  originalContent: null;
  _status: "queued" | "syncing" | "error";
  _tempId: string;
  _offlineId: string;
  _error?: string;
} {
  return {
    id: -Date.now() - Math.random(), // Negative ID to avoid conflicts
    conversationId: msg.conversationId,
    senderId: userId,
    senderType: "user",
    content: msg.content,
    contentType: "text",
    isInternal: msg.isInternal,
    attachments: null,
    metadata: null,
    mentions: null,
    readBy: [userId],
    externalId: null,
    replyToId: msg.replyToId,
    createdAt: msg.createdAt,
    editedAt: null,
    deletedAt: null,
    originalContent: null,
    _status: msg.status === "failed" ? "error" : msg.status === "syncing" ? "syncing" : "queued",
    _tempId: msg.id,
    _offlineId: msg.id,
    _error: msg.lastError ?? undefined,
  };
}
