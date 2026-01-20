import { useCallback, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { conversationsApi, type MessagesResponse } from "@/lib/api/conversations";
import { queryClient } from "@/lib/queryClient";

interface UseInboxMessagesOptions {
  conversationId: number | null;
  setFirstItemIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useInboxMessages({ conversationId, setFirstItemIndex }: UseInboxMessagesOptions) {
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
  } = useInfiniteQuery<MessagesResponse>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return { messages: [], nextCursor: null, hasMore: false };
      }
      return conversationsApi.listMessages(conversationId, pageParam as number | undefined, 30);
    },
    getPreviousPageParam: (firstPage) =>
      firstPage.hasMore ? firstPage.nextCursor : undefined,
    // This list only supports loading older messages (previous pages).
    getNextPageParam: () => undefined,
  });

  const messages = messagesData?.pages
    ? messagesData.pages.flatMap((page) => page.messages)
    : [];

  const loadMoreMessages = useCallback(async () => {
    if (!hasPreviousPage || isFetchingPreviousPage) return;

    try {
      const currentLength = messages.length;
      const result = await fetchPreviousPage();
      const newLength = result.data ? result.data.pages.flatMap((p) => p.messages).length : currentLength;
      const diff = newLength - currentLength;
      if (diff > 0) {
        setFirstItemIndex((prev) => prev - diff);
      }
    } catch (error) {
      console.error("[Inbox] Error loading more messages:", error);
    }
  }, [fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage, messages.length, setFirstItemIndex]);

  // Reset firstItemIndex when conversation changes
  useEffect(() => {
    setFirstItemIndex(10000);
  }, [conversationId, setFirstItemIndex]);

  // Mark messages as read
  useEffect(() => {
    if (!conversationId) return;

    const timeout = setTimeout(async () => {
      try {
        await conversationsApi.markAsRead(conversationId);
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [conversationId]);

  return {
    messages,
    messagesLoading,
    loadMoreMessages,
    hasPreviousPage,
    isFetchingPreviousPage,
  };
}
