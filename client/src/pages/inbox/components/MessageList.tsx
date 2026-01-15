"use client";

import { forwardRef, useMemo } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { MessageGroup } from "./MessageGroup";
import { groupMessages } from "@/pages/inbox/utils/groupMessages";
import type { InboxMessage } from "@/pages/inbox/types";

type Props = {
  messages: InboxMessage[];
  isLoading: boolean;
  firstItemIndex: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreMessages: () => void;
  formatTime: (date: Date | string | null) => string;
  onRetryMessage?: (tempId: string) => void;
  onReplyMessage?: (message: InboxMessage) => void;
  onEditMessage?: (messageId: number, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: number) => Promise<void>;
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
    onRetryMessage,
    onReplyMessage,
    onEditMessage,
    onDeleteMessage,
  },
  ref
) {
  const { t } = useTranslation();

  // Group messages by sender and time proximity
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

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
      data={messageGroups}
      firstItemIndex={firstItemIndex}
      initialTopMostItemIndex={messageGroups.length - 1}
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
      itemContent={(_index, group) => (
        <MessageGroup
          key={group.id}
          group={group}
          formatTime={formatTime}
          onRetryMessage={onRetryMessage}
          onReplyMessage={onReplyMessage}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
        />
      )}
    />
  );
});
