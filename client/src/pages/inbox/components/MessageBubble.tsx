"use client";

import { AtSign, Check, CheckCheck, Clock, AlertCircle, RotateCcw, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FileList } from "@/components/file-uploader";
import { useTranslation } from "@/contexts/LanguageContext";
import { QuotedMessage } from "./QuotedMessage";
import { renderMentionedContent } from "@/hooks/useMentionAutocomplete";
import type { InboxMessage, MessageStatus } from "@/pages/inbox/types";

type MessageBubbleProps = {
  message: InboxMessage;
  isUserMessage: boolean;
  /** Whether to show the timestamp (typically only last message in group) */
  showTimestamp?: boolean;
  /** Function to format time */
  formatTime: (date: Date | string | null) => string;
  /** Handler for retry on error */
  onRetryMessage?: (tempId: string) => void;
  /** Whether this is the first message in a group (affects styling) */
  isFirstInGroup?: boolean;
  /** Whether this is the last message in a group (affects styling) */
  isLastInGroup?: boolean;
};

/**
 * Message status indicator (sending, sent, delivered, read, error)
 */
function MessageStatusIndicator({
  message,
  onRetry,
}: {
  message: InboxMessage;
  onRetry?: () => void;
}) {
  const status: MessageStatus = message._status || (
    message.readBy && message.readBy.length > 0 ? "read" : "sent"
  );

  switch (status) {
    case "sending":
      return (
        <Clock className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />
      );
    case "sent":
      return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="h-3.5 w-3.5 text-primary" />;
    case "error":
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
            >
              <RotateCcw className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      );
    default:
      return <Check className="h-3.5 w-3.5" />;
  }
}

/**
 * Individual message bubble component
 * Used within MessageGroup for grouped messages
 */
export function MessageBubble({
  message,
  isUserMessage,
  showTimestamp = true,
  formatTime,
  onRetryMessage,
  isFirstInGroup = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const { t } = useTranslation();

  // Check if message is deleted
  const isDeleted = !!message.deletedAt;
  // Check if message was edited
  const isEdited = !!message.editedAt;

  // Compute border radius based on position in group
  const getBorderRadius = () => {
    if (isFirstInGroup && isLastInGroup) {
      // Single message - full rounded
      return "rounded-lg";
    }
    if (isUserMessage) {
      // User messages are on the right
      if (isFirstInGroup) return "rounded-lg rounded-br-sm";
      if (isLastInGroup) return "rounded-lg rounded-tr-sm";
      return "rounded-lg rounded-r-sm";
    } else {
      // Other messages are on the left
      if (isFirstInGroup) return "rounded-lg rounded-bl-sm";
      if (isLastInGroup) return "rounded-lg rounded-tl-sm";
      return "rounded-lg rounded-l-sm";
    }
  };

  // Render deleted message state
  if (isDeleted) {
    return (
      <div
        className={`max-w-[65%] px-3 py-2 shadow-sm ${getBorderRadius()} bg-muted/50 border border-dashed border-muted-foreground/30`}
      >
        <p className="text-[14px] italic text-muted-foreground">
          {t("inbox.deleteMessage.deleted")}
        </p>
        {showTimestamp && (
          <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            {formatTime(message.createdAt)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`max-w-[65%] px-3 py-2 shadow-sm ${getBorderRadius()} ${
        message.isInternal
          ? "border border-dashed border-yellow-500/50 bg-yellow-900/30"
          : isUserMessage
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground"
      }`}
    >
      {message.isInternal && isFirstInGroup && (
        <div className="mb-1 flex items-center gap-1 text-xs text-yellow-400">
          <AtSign className="h-3 w-3" />
          {t("inbox.internalNote")}
        </div>
      )}

      {/* Show quoted message if this is a reply */}
      {message.replyTo && (
        <QuotedMessage message={message.replyTo} isUserMessage={isUserMessage} />
      )}

      <p className="whitespace-pre-wrap text-[14px] leading-[19px]">
        {message.content && renderMentionedContent(message.content).map((part, index) =>
          part.type === "mention" ? (
            <span
              key={index}
              className={`font-medium ${
                isUserMessage ? "text-primary-foreground/90" : "text-primary"
              }`}
            >
              {part.value}
            </span>
          ) : (
            <span key={index}>{part.value}</span>
          )
        )}
      </p>

      <FileList entityType="message" entityId={message.id} inline />

      {/* Show timestamp only if showTimestamp is true (typically last in group) */}
      {showTimestamp && (
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          {/* Show edited indicator */}
          {isEdited && (
            <span className="flex items-center gap-0.5">
              <Pencil className="h-2.5 w-2.5" />
              {t("inbox.edited")}
            </span>
          )}
          {isEdited && <span className="mx-0.5">·</span>}
          {formatTime(message.createdAt)}
          {isUserMessage && (
            <MessageStatusIndicator
              message={message}
              onRetry={
                message._tempId && message._status === "error"
                  ? () => onRetryMessage?.(message._tempId!)
                  : undefined
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
