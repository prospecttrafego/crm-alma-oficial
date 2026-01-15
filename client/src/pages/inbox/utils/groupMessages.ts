/**
 * Utility to group messages by sender and time proximity
 * Messages from the same sender within 5 minutes are grouped together
 */

import type { InboxMessage } from "@/pages/inbox/types";

export interface MessageGroup {
  /** Unique identifier for the group (first message ID) */
  id: number;
  /** Sender ID (or null for system messages) */
  senderId: string | null;
  /** Sender type (user, contact, system) */
  senderType: string | null;
  /** Whether these are user's own messages (for alignment) */
  isUserMessage: boolean;
  /** All messages in this group */
  messages: InboxMessage[];
  /** Timestamp of the first message in group */
  startTime: Date;
  /** Timestamp of the last message in group */
  endTime: Date;
}

/** Time threshold for grouping messages (5 minutes in milliseconds) */
const GROUP_TIME_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Check if two messages should be in the same group
 * Messages are grouped if:
 * - Same sender (senderId + senderType)
 * - Same internal note status
 * - Within 5 minutes of each other
 */
function shouldGroupMessages(prev: InboxMessage, current: InboxMessage): boolean {
  // Different sender = different group
  if (prev.senderId !== current.senderId || prev.senderType !== current.senderType) {
    return false;
  }

  // Different internal note status = different group
  if (prev.isInternal !== current.isInternal) {
    return false;
  }

  // Check time proximity
  const prevTime = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
  const currentTime = current.createdAt ? new Date(current.createdAt).getTime() : 0;

  return Math.abs(currentTime - prevTime) <= GROUP_TIME_THRESHOLD_MS;
}

/**
 * Group messages by sender and time proximity
 * @param messages - Array of messages (should be sorted by time ascending)
 * @returns Array of message groups
 */
export function groupMessages(messages: InboxMessage[]): MessageGroup[] {
  if (messages.length === 0) {
    return [];
  }

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    const isUserMessage = message.senderType === "user";
    const messageTime = message.createdAt ? new Date(message.createdAt) : new Date();

    if (currentGroup && shouldGroupMessages(currentGroup.messages[currentGroup.messages.length - 1], message)) {
      // Add to existing group
      currentGroup.messages.push(message);
      currentGroup.endTime = messageTime;
    } else {
      // Start new group
      currentGroup = {
        id: message.id,
        senderId: message.senderId,
        senderType: message.senderType,
        isUserMessage,
        messages: [message],
        startTime: messageTime,
        endTime: messageTime,
      };
      groups.push(currentGroup);
    }
  }

  return groups;
}

/**
 * Format a date for group display (shows date if not today)
 */
export function formatGroupDate(date: Date): string {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
