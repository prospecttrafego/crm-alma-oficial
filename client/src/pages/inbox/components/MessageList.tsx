"use client";

import { forwardRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { AtSign, Check, CheckCheck, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { FileList } from "@/components/file-uploader";
import { useTranslation } from "@/contexts/LanguageContext";
import type { InboxMessage } from "@/pages/inbox/types";

type Props = {
  messages: InboxMessage[];
  isLoading: boolean;
  firstItemIndex: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreMessages: () => void;
  formatTime: (date: Date | string | null) => string;
};

export const MessageList = forwardRef<VirtuosoHandle, Props>(function MessageList(
  {
    messages,
    isLoading,
    firstItemIndex,
    hasNextPage,
    isFetchingNextPage,
    loadMoreMessages,
    formatTime,
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
                message.readBy && message.readBy.length > 0 ? (
                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )
              )}
            </div>
          </div>
        </div>
      )}
    />
  );
});

