"use client";

import { forwardRef, useCallback } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { AtSign, Check, CheckCheck, Clock, Loader2, AlertCircle, RotateCcw } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileList } from "@/components/file-uploader";
import { useTranslation } from "@/contexts/LanguageContext";
import type { InboxMessage, MessageStatus } from "@/pages/inbox/types";

type Props = {
  messages: InboxMessage[];
  isLoading: boolean;
  firstItemIndex: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreMessages: () => void;
  formatTime: (date: Date | string | null) => string;
  onRetryMessage?: (tempId: string) => void;
};

/**
 * Componente para renderizar o indicador de status da mensagem
 */
function MessageStatusIndicator({
  message,
  onRetry,
}: {
  message: InboxMessage;
  onRetry?: () => void;
}) {
  // Determinar status: usa _status se existir, senao infere de readBy
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

export const MessageList = forwardRef<VirtuosoHandle, Props>(function MessageList(
  {
    messages,
    isLoading,
    firstItemIndex,
    hasNextPage,
    isFetchingNextPage,
    loadMoreMessages,
    formatTime,
    onRetryMessage,
  },
  ref
) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
            <Skeleton className="h-16 w-64 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("inbox.noMessages")}
      </div>
    );
  }

  return (
    <Virtuoso
      ref={ref}
      style={{ height: "100%" }}
      data={messages}
      firstItemIndex={firstItemIndex}
      initialTopMostItemIndex={messages.length - 1}
      followOutput="smooth"
      startReached={loadMoreMessages}
      components={{
        Header: () =>
          isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : hasNextPage ? (
            <div className="flex justify-center py-2">
              <span className="text-xs text-muted-foreground">
                Role para carregar mais mensagens
              </span>
            </div>
          ) : null,
      }}
      itemContent={(_index, message) => (
        <div
          key={message.id}
          className={`mb-1 flex ${message.senderType === "user" ? "justify-end" : ""}`}
          data-testid={`message-${message.id}`}
        >
          <div
            className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm ${
              message.isInternal
                ? "border border-dashed border-yellow-500/50 bg-yellow-900/30"
                : message.senderType === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {message.isInternal && (
              <div className="mb-1 flex items-center gap-1 text-xs text-yellow-400">
                <AtSign className="h-3 w-3" />
                Nota interna
              </div>
            )}
            <p className="whitespace-pre-wrap text-[14px] leading-[19px]">{message.content}</p>
            <FileList entityType="message" entityId={message.id} inline />
            <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              {formatTime(message.createdAt)}
              {message.senderType === "user" && (
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
          </div>
        </div>
      )}
    />
  );
});

