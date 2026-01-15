/**
 * Inbox Page
 * Main inbox view with conversation list, message thread, and context panel
 */

import { useEffect, useCallback, useMemo, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  InboxProvider,
  useInbox,
} from "@/contexts/InboxContext";
import {
  conversationsApi,
  type ConversationWithRelations,
  type MessagesResponse,
} from "@/lib/api/conversations";
import { filesApi } from "@/lib/api/files";
import { emailTemplatesApi } from "@/lib/api/emailTemplates";
import type { EmailTemplate } from "@shared/schema";
import { ConversationListPanel } from "@/pages/inbox/components/ConversationListPanel";
import { ContextPanel } from "@/pages/inbox/components/ContextPanel";
import { EmptyState } from "@/pages/inbox/components/EmptyState";
import { MessageComposer } from "@/pages/inbox/components/MessageComposer";
import { MessageList } from "@/pages/inbox/components/MessageList";
import { ThreadHeader } from "@/pages/inbox/components/ThreadHeader";
import { TypingIndicator } from "@/pages/inbox/components/TypingIndicator";
import type { PendingFile, TypingUser } from "@/pages/inbox/types";
import { formatInboxTime, getChannelLabel, getStatusLabel, substituteVariables } from "@/pages/inbox/utils";

// -----------------------------------------------------------------------------
// Inner component that uses InboxContext
// -----------------------------------------------------------------------------

function InboxContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  const {
    selectedConversation,
    setSelectedConversation,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    newMessage,
    setNewMessage,
    isInternalComment,
    setIsInternalComment,
    pendingFiles,
    uploading,
    handleFileSelect,
    removePendingFile,
    fileInputRef,
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    sendAudioMessage,
    listPanelCollapsed,
    setListPanelCollapsed,
    contextPanelCollapsed,
    setContextPanelCollapsed,
    virtuosoRef,
    firstItemIndex,
    setFirstItemIndex,
    playMessageSent,
    playMessageReceived,
    clearMessageState,
  } = useInbox();

  // WebSocket for real-time features
  const { sendTyping, getTypingUsers } = useWebSocket({
    onMessage: (message) => {
      if (message.type === "message:created" && message.data) {
        const messageData = message.data as { senderId?: string; senderType?: string };
        if (messageData.senderType !== "user" || messageData.senderId !== user?.id) {
          playMessageReceived();
        }
      }
    },
  });

  // Get typing users for current conversation
  const currentTypingUsers = selectedConversation
    ? getTypingUsers(selectedConversation.id).filter((t) => t.userId !== user?.id)
    : [];

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!selectedConversation || !user) return;
    sendTyping(selectedConversation.id, user.id, `${user.firstName} ${user.lastName}`);
  }, [selectedConversation, user, sendTyping]);

  // Conversations query
  const { data: conversations, isLoading: conversationsLoading } = useQuery<ConversationWithRelations[]>({
    queryKey: ["/api/conversations"],
    queryFn: conversationsApi.list,
  });

  // Messages infinite query
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<MessagesResponse>({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      if (!selectedConversation?.id) {
        return { messages: [], nextCursor: null, hasMore: false };
      }
      return conversationsApi.listMessages(selectedConversation.id, pageParam as number | undefined, 30);
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });

  const messages = messagesData?.pages
    ? messagesData.pages.flatMap((page) => page.messages)
    : [];

  const loadMoreMessages = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      const currentLength = messages.length;
      fetchNextPage().then(() => {
        const newLength = messagesData?.pages
          ? messagesData.pages.flatMap((p) => p.messages).length
          : 0;
        const diff = newLength - currentLength;
        if (diff > 0) {
          setFirstItemIndex((prev) => prev - diff);
        }
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages.length, messagesData, setFirstItemIndex]);

  // Reset firstItemIndex when conversation changes
  useEffect(() => {
    setFirstItemIndex(10000);
  }, [selectedConversation?.id, setFirstItemIndex]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedConversation?.id) return;

    const timeout = setTimeout(async () => {
      try {
        await conversationsApi.markAsRead(selectedConversation.id);
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [selectedConversation?.id]);

  const { data: emailTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
    queryFn: emailTemplatesApi.list,
  });

  const applyTemplate = useCallback((template: EmailTemplate) => {
    const company = selectedConversation?.company || selectedConversation?.contact?.company;
    const substitutedBody = substituteVariables(template.body, {
      contact: selectedConversation?.contact,
      deal: selectedConversation?.deal,
      company: company,
      user: user,
    });
    setNewMessage(substitutedBody);
    toast({ title: t("toast.updated") });
  }, [selectedConversation, user, setNewMessage, toast, t]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; isInternal: boolean; attachments?: PendingFile[] }) => {
      if (!selectedConversation) return;
      const messageData = await conversationsApi.sendMessage(selectedConversation.id, {
        content: data.content,
        isInternal: data.isInternal,
      });

      if (data.attachments && data.attachments.length > 0) {
        for (const pf of data.attachments) {
          if (pf.uploadURL && pf.status === "uploaded") {
            await filesApi.register({
              name: pf.file.name,
              mimeType: pf.file.type,
              size: pf.file.size,
              uploadURL: pf.uploadURL,
              entityType: "message",
              entityId: messageData.id,
            });
          }
        }
      }
      return messageData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      clearMessageState();
      playMessageSent();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "destructive" });
    },
  });

  // Memoized filtered conversations
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];

    return conversations.filter((conv) => {
      if (filters.channel && conv.channel !== filters.channel) return false;
      if (filters.status && conv.status !== filters.status) return false;
      if (filters.assignedToId && conv.assignedToId !== filters.assignedToId) return false;

      if (!searchQuery) return true;
      const contactName = conv.contact
        ? `${conv.contact.firstName} ${conv.contact.lastName}`.toLowerCase()
        : "";
      return (
        contactName.includes(searchQuery.toLowerCase()) ||
        conv.subject?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [conversations, filters, searchQuery]);

  // Keyboard shortcuts - use refs to avoid re-registering handler on every state change
  const selectedConversationRef = useRef(selectedConversation);
  const filteredConversationsRef = useRef(filteredConversations);

  // Keep refs in sync with current values
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    filteredConversationsRef.current = filteredConversations;
  }, [filteredConversations]);

  // Register keyboard handler once
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";

      if (e.key === "j" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversationsRef.current || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversationRef.current
          ? list.findIndex((c) => c.id === selectedConversationRef.current?.id)
          : -1;
        const nextIndex = currentIndex < list.length - 1 ? currentIndex + 1 : currentIndex;
        if (list[nextIndex]) {
          setSelectedConversation(list[nextIndex]);
        }
      }

      if (e.key === "k" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversationsRef.current || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversationRef.current
          ? list.findIndex((c) => c.id === selectedConversationRef.current?.id)
          : list.length;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (list[prevIndex]) {
          setSelectedConversation(list[prevIndex]);
        }
      }

      if (!selectedConversationRef.current) return;
      if (e.key === "r" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        setIsInternalComment(false);
        document.getElementById("message-input")?.focus();
      }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        setIsInternalComment(true);
        document.getElementById("message-input")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedConversation, setIsInternalComment]);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && pendingFiles.length === 0) return;
    sendMessageMutation.mutate({
      content: newMessage || (pendingFiles.length > 0 ? "[Attachment]" : ""),
      isInternal: isInternalComment,
      attachments: pendingFiles.filter((f) => f.status === "uploaded"),
    });
  }, [newMessage, pendingFiles, isInternalComment, sendMessageMutation]);

  const formatTime = useCallback((date: Date | string | null) => formatInboxTime(t, date), [t]);
  const channelLabel = useCallback((channel: string) => getChannelLabel(t, channel), [t]);
  const statusLabel = useCallback((status: string) => getStatusLabel(t, status), [t]);

  return (
    <div className="flex h-full">
      <div
        className={`flex w-full flex-col border-r border-border bg-background transition-all duration-200 md:w-[350px] ${
          selectedConversation ? "hidden md:flex" : "flex"
        } ${listPanelCollapsed ? "lg:w-12" : "lg:w-[350px]"}`}
      >
        <ConversationListPanel
          collapsed={listPanelCollapsed}
          conversationsLoading={conversationsLoading}
          filteredConversations={filteredConversations}
          onSelectConversation={setSelectedConversation}
          selectedConversationId={selectedConversation?.id}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          formatTime={formatTime}
          onExpandFromRail={() => setListPanelCollapsed(false)}
        />
      </div>

      {selectedConversation ? (
        <>
          <div className="flex flex-1 flex-col bg-background">
            <ThreadHeader
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
              listPanelCollapsed={listPanelCollapsed}
              onToggleListPanel={() => setListPanelCollapsed((prev) => !prev)}
              contextPanelCollapsed={contextPanelCollapsed}
              onToggleContextPanel={() => setContextPanelCollapsed((prev) => !prev)}
            />

            <div className="flex-1 overflow-hidden bg-muted/30 px-[5%] py-4">
              <MessageList
                ref={virtuosoRef}
                messages={messages}
                isLoading={messagesLoading}
                firstItemIndex={firstItemIndex}
                hasNextPage={!!hasNextPage}
                isFetchingNextPage={!!isFetchingNextPage}
                loadMoreMessages={loadMoreMessages}
                formatTime={formatTime}
              />
            </div>

            <TypingIndicator typingUsers={currentTypingUsers as TypingUser[]} />

            <MessageComposer
              onSubmit={handleSendMessage}
              isRecording={isRecording}
              recordingTime={recordingTime}
              audioBlob={audioBlob}
              onCancelRecording={cancelRecording}
              onStopRecording={stopRecording}
              onSendAudioMessage={sendAudioMessage}
              isSending={sendMessageMutation.isPending}
              isInternalComment={isInternalComment}
              setIsInternalComment={setIsInternalComment}
              emailTemplates={emailTemplates}
              onApplyTemplate={applyTemplate}
              pendingFiles={pendingFiles}
              uploading={uploading}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onRemovePendingFile={removePendingFile}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              onTyping={handleTyping}
              onStartRecording={startRecording}
            />
          </div>

          <div
            className={`hidden lg:flex flex-col border-l border-border bg-background transition-all duration-200 ${
              contextPanelCollapsed ? "w-12" : "w-72"
            }`}
          >
            <ContextPanel
              conversation={selectedConversation}
              collapsed={contextPanelCollapsed}
              getChannelLabel={channelLabel}
              getStatusLabel={statusLabel}
            />
          </div>
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main export with provider
// -----------------------------------------------------------------------------

export default function InboxPage() {
  return (
    <InboxProvider>
      <InboxContent />
    </InboxProvider>
  );
}
