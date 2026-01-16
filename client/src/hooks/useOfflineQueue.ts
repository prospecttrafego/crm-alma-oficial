/**
 * Hook for managing offline message queue
 *
 * Provides state and methods for:
 * - Queuing messages when offline
 * - Syncing messages when back online
 * - Tracking queue status
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  addOfflineMessage,
  getQueuedMessages,
  getOfflineMessagesForConversation,
  removeOfflineMessage,
  updateOfflineMessageStatus,
  getQueuedMessageCount,
  type OfflineMessage,
} from "@/lib/offlineDb";
import { conversationsApi } from "@/lib/api/conversations";

interface UseOfflineQueueOptions {
  onSyncComplete?: (successCount: number, failedCount: number) => void;
  onSyncStart?: () => void;
  onMessageSynced?: (offlineId: string, serverId: number) => void;
  maxRetries?: number;
}

interface UseOfflineQueueReturn {
  // State
  isOnline: boolean;
  isSyncing: boolean;
  queueCount: number;
  offlineMessages: OfflineMessage[];

  // Actions
  queueMessage: (message: {
    conversationId: number;
    content: string;
    isInternal: boolean;
    replyToId?: number | null;
  }) => Promise<OfflineMessage>;
  syncQueue: () => Promise<void>;
  getMessagesForConversation: (conversationId: number) => Promise<OfflineMessage[]>;
  removeFromQueue: (id: string) => Promise<void>;
  refreshQueue: () => Promise<void>;
}

const MAX_RETRIES_DEFAULT = 3;

export function useOfflineQueue(options: UseOfflineQueueOptions = {}): UseOfflineQueueReturn {
  const {
    onSyncComplete,
    onSyncStart,
    onMessageSynced,
    maxRetries = MAX_RETRIES_DEFAULT,
  } = options;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [offlineMessages, setOfflineMessages] = useState<OfflineMessage[]>([]);

  const syncInProgressRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Online/Offline detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load queue on mount
  // ---------------------------------------------------------------------------

  const refreshQueue = useCallback(async () => {
    try {
      const count = await getQueuedMessageCount();
      const messages = await getQueuedMessages();
      setQueueCount(count);
      setOfflineMessages(messages);
    } catch (error) {
      console.error("[OfflineQueue] Error loading queue:", error);
    }
  }, []);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  // ---------------------------------------------------------------------------
  // Auto-sync when coming back online
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing && !syncInProgressRef.current) {
      // Small delay to let connection stabilize
      const timeout = setTimeout(() => {
        syncQueue();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queueCount]);

  // ---------------------------------------------------------------------------
  // Queue a message for later sync
  // ---------------------------------------------------------------------------

  const queueMessage = useCallback(async (message: {
    conversationId: number;
    content: string;
    isInternal: boolean;
    replyToId?: number | null;
  }): Promise<OfflineMessage> => {
    const offlineMsg = await addOfflineMessage({
      conversationId: message.conversationId,
      content: message.content,
      isInternal: message.isInternal,
      replyToId: message.replyToId ?? null,
      attachments: null, // TODO: Handle offline attachments
    });

    await refreshQueue();
    return offlineMsg;
  }, [refreshQueue]);

  // ---------------------------------------------------------------------------
  // Sync all queued messages
  // ---------------------------------------------------------------------------

  const syncQueue = useCallback(async () => {
    if (syncInProgressRef.current || !isOnline) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);
    onSyncStart?.();

    let successCount = 0;
    let failedCount = 0;

    try {
      const queuedMessages = await getQueuedMessages();

      for (const msg of queuedMessages) {
        // Skip if exceeded max retries
        if (msg.retryCount >= maxRetries) {
          console.warn(`[OfflineQueue] Message ${msg.id} exceeded max retries, marking as failed`);
          await updateOfflineMessageStatus(msg.id, "failed", "Max retries exceeded");
          failedCount++;
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
            externalId: msg.id, // Use offline ID for deduplication
          });

          // Remove from queue on success
          await removeOfflineMessage(msg.id);
          successCount++;
          onMessageSynced?.(msg.id, serverMessage.id);
        } catch (error) {
          // Mark as queued again for retry
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await updateOfflineMessageStatus(msg.id, "queued", errorMessage);
          failedCount++;
          console.error(`[OfflineQueue] Failed to sync message ${msg.id}:`, error);
        }
      }
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
      await refreshQueue();
      onSyncComplete?.(successCount, failedCount);
    }
  }, [isOnline, maxRetries, onSyncStart, onSyncComplete, onMessageSynced, refreshQueue]);

  // ---------------------------------------------------------------------------
  // Get messages for a specific conversation
  // ---------------------------------------------------------------------------

  const getMessagesForConversation = useCallback(async (conversationId: number): Promise<OfflineMessage[]> => {
    return getOfflineMessagesForConversation(conversationId);
  }, []);

  // ---------------------------------------------------------------------------
  // Remove message from queue
  // ---------------------------------------------------------------------------

  const removeFromQueue = useCallback(async (id: string) => {
    await removeOfflineMessage(id);
    await refreshQueue();
  }, [refreshQueue]);

  return {
    isOnline,
    isSyncing,
    queueCount,
    offlineMessages,
    queueMessage,
    syncQueue,
    getMessagesForConversation,
    removeFromQueue,
    refreshQueue,
  };
}
