"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { MessageBubble } from "./MessageBubble";
import { MessageActions } from "./MessageActions";
import { EditMessageModal } from "./EditMessageModal";
import type { MessageGroup as MessageGroupType } from "@/pages/inbox/utils/groupMessages";
import type { InboxMessage } from "@/pages/inbox/types";

type MessageGroupProps = {
  group: MessageGroupType;
  formatTime: (date: Date | string | null) => string;
  onRetryMessage?: (tempId: string) => void;
  onReplyMessage?: (message: InboxMessage) => void;
  onEditMessage?: (messageId: number, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: number) => Promise<void>;
  /** Sender info for avatar display */
  senderInfo?: {
    name?: string;
    avatarUrl?: string;
  };
};

/**
 * Renders a group of messages from the same sender
 * Shows avatar only on the first message, timestamp on the last
 */
export function MessageGroup({
  group,
  formatTime,
  onRetryMessage,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
}: MessageGroupProps) {
  const { t } = useTranslation();
  const [editingMessage, setEditingMessage] = useState<InboxMessage | null>(null);

  const { messages, isUserMessage } = group;

  // Get initials from first message's sender (if available)
  const getInitials = () => {
    const firstMessage = messages[0];
    if (firstMessage.sender) {
      const first = firstMessage.sender.firstName?.[0] || "";
      const last = firstMessage.sender.lastName?.[0] || "";
      return `${first}${last}`.toUpperCase() || "?";
    }
    return "?";
  };

  const showActions = (message: InboxMessage) => {
    return message.id > 0 && !message.deletedAt; // Don't show for optimistic or deleted messages
  };

  const handleEditClick = (messageId: number) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setEditingMessage(message);
    }
  };

  const handleEditSave = async (messageId: number, content: string) => {
    if (onEditMessage) {
      await onEditMessage(messageId, content);
    }
    setEditingMessage(null);
  };

  const handleReply = (messageId: number) => {
    const message = messages.find((m) => m.id === messageId);
    if (message && onReplyMessage) {
      onReplyMessage(message);
    }
  };

  return (
    <>
      <div
        className={`group relative mb-3 flex gap-2 ${isUserMessage ? "flex-row-reverse" : ""}`}
        data-testid={`message-group-${group.id}`}
      >
        {/* Avatar - only shown for non-user messages */}
        {!isUserMessage && (
          <div className="flex-shrink-0 self-end">
            <Avatar className="h-8 w-8">
              <AvatarImage src={messages[0].sender?.profileImageUrl || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Messages stack */}
        <div className={`flex flex-col gap-0.5 ${isUserMessage ? "items-end" : "items-start"}`}>
          {messages.map((message, index) => {
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;
            const canShowActions = showActions(message);

            return (
              <div
                key={message.id}
                className="group/message relative"
                data-testid={`message-${message.id}`}
              >
                {/* Action menu - appears on hover */}
                {canShowActions && (
                  <div
                    className={`absolute top-0 z-10 opacity-0 transition-opacity group-hover/message:opacity-100 ${
                      isUserMessage ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1"
                    }`}
                  >
                    <MessageActions
                      messageId={message.id}
                      content={message.content}
                      createdAt={message.createdAt}
                      isUserMessage={isUserMessage}
                      onEdit={handleEditClick}
                      onDelete={onDeleteMessage || (async () => {})}
                      onReply={handleReply}
                    />
                  </div>
                )}

                <MessageBubble
                  message={message}
                  isUserMessage={isUserMessage}
                  showTimestamp={isLast}
                  formatTime={formatTime}
                  onRetryMessage={onRetryMessage}
                  isFirstInGroup={isFirst}
                  isLastInGroup={isLast}
                />
              </div>
            );
          })}
        </div>

        {/* Spacer for user messages to align with avatar space */}
        {isUserMessage && <div className="w-8 flex-shrink-0" />}
      </div>

      {/* Edit message modal */}
      <EditMessageModal
        open={!!editingMessage}
        onOpenChange={(open) => !open && setEditingMessage(null)}
        messageId={editingMessage?.id || null}
        currentContent={editingMessage?.content || ""}
        createdAt={editingMessage?.createdAt || null}
        onSave={handleEditSave}
      />
    </>
  );
}
