/**
 * Inbox Page Content
 * Main inbox view with conversation list, message thread, and context panel
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { useConversationRoom } from "@/hooks/useConversationRoom";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useTranslation } from "@/contexts/LanguageContext";
import { useInbox } from "@/contexts/InboxContext";
import { emailTemplatesApi } from "@/lib/api/emailTemplates";
import type { EmailTemplate } from "@shared/schema";
import { ConversationListPanel } from "@/pages/inbox/components/ConversationListPanel";
import { ContextPanel } from "@/pages/inbox/components/ContextPanel";
import { EmptyState } from "@/pages/inbox/components/EmptyState";
import { MessageComposer } from "@/pages/inbox/components/MessageComposer";
import { MessageList } from "@/pages/inbox/components/MessageList";
import { MessageSearchModal } from "@/pages/inbox/components/MessageSearchModal";
import { ThreadHeader } from "@/pages/inbox/components/ThreadHeader";
import { TypingIndicator } from "@/pages/inbox/components/TypingIndicator";
import type { TypingUser } from "@/pages/inbox/types";
import { formatInboxTime, getChannelLabel, getStatusLabel, substituteVariables } from "@/pages/inbox/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useInboxConversations } from "@/pages/inbox/hooks/useInboxConversations";
import { useInboxMessages } from "@/pages/inbox/hooks/useInboxMessages";
import { useInboxMutations } from "@/pages/inbox/hooks/useInboxMutations";
import { useInboxShortcuts } from "@/pages/inbox/hooks/useInboxShortcuts";
import type { MessageSearchResult } from "@/lib/api/conversations";

export function InboxContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Message search modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);

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
    replyingTo,
    setReplyingTo,
    cancelReply,
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

  // WebSocket for real-time features (shared connection)
  const { sendTyping, getTypingUsers, isConnected: wsConnected, subscribe } = useWebSocketContext();
  const listPanelRef = useRef<ImperativePanelHandle>(null);
  const contextPanelRef = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    return subscribe((message) => {
      if (message.type !== "message:created" || !message.data) return;
      const messageData = message.data as { senderId?: string; senderType?: string };
      if (messageData.senderType !== "user" || messageData.senderId !== user?.id) {
        playMessageReceived();
      }
    });
  }, [subscribe, user?.id, playMessageReceived]);

  // Offline queue for message resilience
  const { isOnline, queueMessage } = useOfflineQueue({
    onSyncComplete: (successCount, failedCount) => {
      if (successCount > 0) {
        toast({ title: t("inbox.offlineSync.synced", { count: successCount }) });
        // Refresh messages after sync
        if (selectedConversation) {
          queryClient.invalidateQueries({
            queryKey: ["/api/conversations", selectedConversation.id, "messages"],
          });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }
      if (failedCount > 0) {
        toast({
          title: t("inbox.offlineSync.failed", { count: failedCount }),
          variant: "destructive",
        });
      }
    },
  });

  useEffect(() => {
    const panel = listPanelRef.current;
    if (!panel) return;
    if (listPanelCollapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [listPanelCollapsed]);

  useEffect(() => {
    const panel = contextPanelRef.current;
    if (!panel) return;
    if (contextPanelCollapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [contextPanelCollapsed]);

  // Inscrever na room da conversa selecionada para receber eventos direcionados
  useConversationRoom(selectedConversation?.id ?? null);

  // Get typing users for current conversation
  const currentTypingUsers = selectedConversation
    ? getTypingUsers(selectedConversation.id).filter((t) => t.userId !== user?.id)
    : [];

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!selectedConversation || !user) return;
    sendTyping(selectedConversation.id, user.id, `${user.firstName} ${user.lastName}`);
  }, [selectedConversation, user, sendTyping]);

  const { conversations, conversationsLoading } = useInboxConversations();
  const {
    messages,
    messagesLoading,
    loadMoreMessages,
    hasPreviousPage,
    isFetchingPreviousPage,
  } = useInboxMessages({
    conversationId: selectedConversation?.id ?? null,
    setFirstItemIndex,
  });

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

  const {
    sendMessageMutation,
    retryMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleSendMessage,
  } = useInboxMutations({
    selectedConversation,
    user: user ?? null,
    pendingFiles,
    isInternalComment,
    replyingTo,
    newMessage,
    clearMessageState,
    playMessageSent,
    isOnline,
    wsConnected,
    queueMessage,
    toast,
    t,
  });

  const handleSelectSearchResult = useCallback((result: MessageSearchResult) => {
    if (!conversations) return;

    // Find the conversation that contains this message
    const conversation = conversations.find((c) => c.id === result.conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
    }
  }, [conversations, setSelectedConversation]);

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

  useInboxShortcuts({
    selectedConversation,
    filteredConversations,
    setSelectedConversation,
    setIsInternalComment,
    onOpenSearch: () => setSearchModalOpen(true),
  });

  const formatTime = useCallback((date: Date | string | null) => formatInboxTime(t, date), [t]);
  const channelLabel = useCallback((channel: string) => getChannelLabel(t, channel), [t]);
  const statusLabel = useCallback((status: string) => getStatusLabel(t, status), [t]);

  return (
    <div className="h-full">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel
          ref={listPanelRef}
          defaultSize={28}
          minSize={18}
          maxSize={45}
          collapsible
          collapsedSize={6}
          onCollapse={() => setListPanelCollapsed(true)}
          onExpand={() => setListPanelCollapsed(false)}
          className={`border-r border-border bg-background ${selectedConversation ? "hidden md:flex" : "flex"}`}
        >
          <div className="flex h-full w-full flex-col">
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
        </ResizablePanel>

        <ResizableHandle withHandle className="hidden md:flex" />

        <ResizablePanel defaultSize={72} minSize={40} className="flex bg-background">
          {selectedConversation ? (
            <div className="flex h-full w-full">
              <div className="flex flex-1 flex-col bg-background">
                <ThreadHeader
                  conversation={selectedConversation}
                  onBack={() => setSelectedConversation(null)}
                  listPanelCollapsed={listPanelCollapsed}
                  onToggleListPanel={() => setListPanelCollapsed((prev) => !prev)}
                  contextPanelCollapsed={contextPanelCollapsed}
                  onToggleContextPanel={() => setContextPanelCollapsed((prev) => !prev)}
                  onSearchClick={() => setSearchModalOpen(true)}
                />

                <div className="flex-1 overflow-hidden bg-muted/30 px-[5%] py-4">
                  <MessageList
                    ref={virtuosoRef}
                    messages={messages}
                    isLoading={messagesLoading}
                    firstItemIndex={firstItemIndex}
                    hasNextPage={!!hasPreviousPage}
                    isFetchingNextPage={!!isFetchingPreviousPage}
                    loadMoreMessages={loadMoreMessages}
                    formatTime={formatTime}
                    onRetryMessage={retryMessage}
                    onReplyMessage={setReplyingTo}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
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
                  replyingTo={replyingTo}
                  onCancelReply={cancelReply}
                />
              </div>
              {selectedConversation && (
                <>
                  <ResizableHandle withHandle className="hidden lg:flex" />
                  <ResizablePanel
                    ref={contextPanelRef}
                    defaultSize={25}
                    minSize={18}
                    maxSize={35}
                    collapsible
                    collapsedSize={6}
                    onCollapse={() => setContextPanelCollapsed(true)}
                    onExpand={() => setContextPanelCollapsed(false)}
                    className="hidden lg:flex border-l border-border bg-background"
                  >
                    <ContextPanel
                      conversation={selectedConversation}
                      collapsed={contextPanelCollapsed}
                      getChannelLabel={channelLabel}
                      getStatusLabel={statusLabel}
                      onConversationUpdated={setSelectedConversation}
                    />
                  </ResizablePanel>
                </>
              )}
            </div>
          ) : (
            <EmptyState />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Message Search Modal */}
      <MessageSearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        conversationId={selectedConversation?.id}
        onSelectMessage={handleSelectSearchResult}
      />
    </div>
  );
}
