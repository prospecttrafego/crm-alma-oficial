/**
 * Offline Database using IndexedDB
 *
 * Stores messages that failed to send while offline.
 * When connection is restored, these messages are synced to the server.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Types for offline queue entries
export interface OfflineMessage {
  id: string; // UUID for tracking
  conversationId: number;
  content: string;
  isInternal: boolean;
  replyToId: number | null;
  attachments: OfflineAttachment[] | null;
  createdAt: Date;
  status: "queued" | "syncing" | "failed";
  retryCount: number;
  lastError: string | null;
}

export interface OfflineAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadURL?: string;
  blob?: Blob;
}

// IndexedDB schema
interface CrmOfflineDB extends DBSchema {
  "offline-messages": {
    key: string;
    value: OfflineMessage;
    indexes: {
      "by-conversation": number;
      "by-status": string;
      "by-created": Date;
    };
  };
}

const DB_NAME = "crm-offline-db";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<CrmOfflineDB> | null = null;

/**
 * Initialize and return the IndexedDB instance
 */
export async function getOfflineDb(): Promise<IDBPDatabase<CrmOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<CrmOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create offline-messages store if it doesn't exist
      if (!db.objectStoreNames.contains("offline-messages")) {
        const store = db.createObjectStore("offline-messages", { keyPath: "id" });
        store.createIndex("by-conversation", "conversationId");
        store.createIndex("by-status", "status");
        store.createIndex("by-created", "createdAt");
      }
    },
  });

  return dbInstance;
}

// -----------------------------------------------------------------------------
// CRUD Operations
// -----------------------------------------------------------------------------

/**
 * Add a message to the offline queue
 */
export async function addOfflineMessage(message: Omit<OfflineMessage, "id" | "createdAt" | "status" | "retryCount" | "lastError">): Promise<OfflineMessage> {
  const db = await getOfflineDb();

  const offlineMsg: OfflineMessage = {
    ...message,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    status: "queued",
    retryCount: 0,
    lastError: null,
  };

  await db.add("offline-messages", offlineMsg);
  return offlineMsg;
}

/**
 * Get all queued messages for a conversation
 */
export async function getOfflineMessagesForConversation(conversationId: number): Promise<OfflineMessage[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex("offline-messages", "by-conversation", conversationId);
}

/**
 * Get all queued messages (pending sync)
 */
export async function getQueuedMessages(): Promise<OfflineMessage[]> {
  const db = await getOfflineDb();
  const all = await db.getAllFromIndex("offline-messages", "by-status", "queued");
  // Sort by createdAt (oldest first for FIFO)
  return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Get all offline messages (any status)
 */
export async function getAllOfflineMessages(): Promise<OfflineMessage[]> {
  const db = await getOfflineDb();
  const all = await db.getAll("offline-messages");
  return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Update message status
 */
export async function updateOfflineMessageStatus(
  id: string,
  status: OfflineMessage["status"],
  lastError?: string
): Promise<OfflineMessage | undefined> {
  const db = await getOfflineDb();
  const message = await db.get("offline-messages", id);

  if (!message) return undefined;

  // Increment retry count only when we are re-queuing after a failed sync attempt.
  // Marking as "failed" is terminal and should not bump the counter again.
  const shouldIncrementRetryCount =
    status === "queued" && typeof lastError === "string" && lastError.trim().length > 0;

  const updated: OfflineMessage = {
    ...message,
    status,
    retryCount: shouldIncrementRetryCount ? message.retryCount + 1 : message.retryCount,
    lastError: lastError ?? message.lastError,
  };

  await db.put("offline-messages", updated);
  return updated;
}

/**
 * Remove a message from the offline queue (after successful sync)
 */
export async function removeOfflineMessage(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete("offline-messages", id);
}

/**
 * Clear all offline messages (useful after logout)
 */
export async function clearOfflineMessages(): Promise<void> {
  const db = await getOfflineDb();
  await db.clear("offline-messages");
}

/**
 * Get count of queued messages
 */
export async function getQueuedMessageCount(): Promise<number> {
  const db = await getOfflineDb();
  return db.countFromIndex("offline-messages", "by-status", "queued");
}

/**
 * Check if there are any messages in the offline queue
 */
export async function hasOfflineMessages(): Promise<boolean> {
  const count = await getQueuedMessageCount();
  return count > 0;
}
