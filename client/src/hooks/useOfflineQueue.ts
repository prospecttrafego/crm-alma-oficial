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
  getQueuedMessageCount,
  type OfflineMessage,
} from "@/lib/offlineDb";
import { syncEvents, syncOfflineMessages } from "@/lib/offlineSync";

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
  // Sync events (driven by offlineSync + WebSocket reconnect)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubStart = syncEvents.on("sync:start", () => {
      setIsSyncing(true);
      onSyncStart?.();
    });

    const unsubMessage = syncEvents.on("message:synced", (data) => {
      onMessageSynced?.(data.offlineId, data.serverId);
    });

    const unsubComplete = syncEvents.on("sync:complete", async (result) => {
      setIsSyncing(false);
      await refreshQueue();
      onSyncComplete?.(result.success, result.failed);
    });

    const unsubError = syncEvents.on("sync:error", async (_data) => {
      setIsSyncing(false);
      await refreshQueue();
      // Mantemos o estado da fila e deixamos o caller decidir UX via onSyncComplete/onError
    });

    return () => {
      unsubStart();
      unsubMessage();
      unsubComplete();
      unsubError();
    };
  }, [onMessageSynced, onSyncComplete, onSyncStart, refreshQueue]);

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
  // Manual sync trigger (engine lives in offlineSync)
  // ---------------------------------------------------------------------------

  const syncQueue = useCallback(async () => {
    try {
      if (syncInProgressRef.current || !isOnline) return;
      syncInProgressRef.current = true;
      await syncOfflineMessages({ maxRetries });
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isOnline, maxRetries]);

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
