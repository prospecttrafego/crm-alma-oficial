/**
 * Inbox Page
 * Main inbox view with conversation list, message thread, and context panel
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket, useConversationRoom } from "@/hooks/useWebSocket";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  InboxProvider,
  useInbox,
} from "@/contexts/InboxContext";
import {
  conversationsApi,
  type ConversationWithRelations,
  type MessagesResponse,
  type MessageSearchResult,
} from "@/lib/api/conversations";
import { filesApi } from "@/lib/api/files";
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
import type { PendingFile, TypingUser, InboxMessage } from "@/pages/inbox/types";
import { formatInboxTime, getChannelLabel, getStatusLabel, substituteVariables } from "@/pages/inbox/utils";

// -----------------------------------------------------------------------------
// Inner component that uses InboxContext
// -----------------------------------------------------------------------------

function InboxContent() {
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

  // WebSocket for real-time features
  const { sendTyping, getTypingUsers, isConnected: wsConnected } = useWebSocket({
    onMessage: (message) => {
      if (message.type === "message:created" && message.data) {
        const messageData = message.data as { senderId?: string; senderType?: string };
        if (messageData.senderType !== "user" || messageData.senderId !== user?.id) {
          playMessageReceived();
        }
      }
    },
  });

  // Offline queue for message resilience
  const { isOnline, queueMessage, queueCount, isSyncing } = useOfflineQueue({
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

  // Inscrever na room da conversa selecionada para receber eventos direcionados
  // (mensagens, typing indicators, etc.) ao inves de broadcast global
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

  /**
   * Mutation com optimistic updates para envio de mensagens
   * A mensagem aparece imediatamente com status "sending"
   */
  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      isInternal: boolean;
      attachments?: PendingFile[];
      replyToId?: number | null; // ID da mensagem sendo respondida
      _tempId: string; // ID temporario para tracking
    }) => {
      if (!selectedConversation) throw new Error("No conversation selected");

      const messageData = await conversationsApi.sendMessage(selectedConversation.id, {
        content: data.content,
        isInternal: data.isInternal,
        // Enviar _tempId como externalId para idempotencia em retries
        externalId: data._tempId,
        // Reply/quote feature
        replyToId: data.replyToId ?? undefined,
      });

      // Registrar arquivos se houver
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

      return { ...messageData, _tempId: data._tempId };
    },

    // OPTIMISTIC UPDATE: Inserir mensagem no cache ANTES de enviar ao servidor
    onMutate: async (newMessageData) => {
      if (!selectedConversation || !user) return;

      const queryKey = ["/api/conversations", selectedConversation.id, "messages"];

      // 1. Cancelar refetches pendentes para evitar sobrescrever nosso update
      await queryClient.cancelQueries({ queryKey });

      // 2. Snapshot do estado atual (para rollback em caso de erro)
      const previousMessages = queryClient.getQueryData<{ pages: MessagesResponse[] }>(queryKey);

      // 3. Criar mensagem otimista
      const optimisticMessage: InboxMessage = {
        id: -Date.now(), // ID negativo temporario
        conversationId: selectedConversation.id,
        senderId: user.id,
        senderType: "user",
        content: newMessageData.content,
        contentType: "text",
        isInternal: newMessageData.isInternal,
        attachments: null,
        metadata: null,
        mentions: null,
        readBy: [user.id], // Usuario ja "leu" sua propria mensagem
        externalId: null,
        replyToId: newMessageData.replyToId ?? null,
        createdAt: new Date(), // Date object, nao string
        editedAt: null,
        deletedAt: null,
        originalContent: null,
        // Campos de optimistic update
        _status: "sending",
        _tempId: newMessageData._tempId,
      };

      // 4. Inserir mensagem otimista no cache
      queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKey,
        (old) => {
          if (!old || !old.pages || old.pages.length === 0) {
            return {
              pages: [{ messages: [optimisticMessage], nextCursor: null, hasMore: false }],
              pageParams: [undefined],
            };
          }

          // Append na ultima pagina (mensagens mais recentes)
          const newPages = [...old.pages];
          const lastPageIndex = newPages.length - 1;
          newPages[lastPageIndex] = {
            ...newPages[lastPageIndex],
            messages: [...newPages[lastPageIndex].messages, optimisticMessage],
          };

          return { ...old, pages: newPages };
        }
      );

      // 5. Atualizar lista de conversas (lastMessageAt)
      queryClient.setQueryData<ConversationWithRelations[]>(
        ["/api/conversations"],
        (old) => {
          if (!old) return old;
          return old
            .map((conv) =>
              conv.id === selectedConversation.id
                ? { ...conv, lastMessageAt: new Date() }
                : conv
            )
            .sort((a, b) => {
              const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return bTime - aTime;
            });
        }
      );

      // Retornar contexto para rollback
      return { previousMessages, tempId: newMessageData._tempId };
    },

    // SUCESSO: Substituir mensagem otimista pela real
    onSuccess: (serverMessage, variables, context) => {
      if (!selectedConversation || !serverMessage || !context) return;

      const queryKey = ["/api/conversations", selectedConversation.id, "messages"];

      // Substituir mensagem otimista pela mensagem real do servidor
      queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKey,
        (old) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg._tempId === context.tempId
                  ? { ...serverMessage, _status: "sent" as const, _tempId: undefined } as InboxMessage
                  : msg
              ),
            })),
          };
        }
      );

      // Atualizar conversa com dados reais
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      clearMessageState();
      playMessageSent();
    },

    // ERRO: Rollback para estado anterior e marcar mensagem como erro
    onError: (error, variables, context) => {
      if (!context?.previousMessages || !selectedConversation) {
        toast({ title: t("toast.error"), variant: "destructive" });
        return;
      }

      const queryKey = ["/api/conversations", selectedConversation.id, "messages"];

      // Marcar mensagem como erro (em vez de remover, para permitir retry)
      queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKey,
        (old) => {
          if (!old) return context.previousMessages as { pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] };

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg._tempId === context.tempId
                  ? { ...msg, _status: "error" as const, _error: String(error) }
                  : msg
              ),
            })),
          };
        }
      );

      toast({
        title: t("toast.error"),
        description: "Falha ao enviar mensagem. Clique para tentar novamente.",
        variant: "destructive"
      });
    },
  });

  /**
   * Retry de mensagem que falhou
   */
  const retryMessage = useCallback((tempId: string) => {
    if (!selectedConversation) return;

    const queryKey = ["/api/conversations", selectedConversation.id, "messages"];
    const data = queryClient.getQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }> }>(queryKey);

    if (!data) return;

    // Encontrar mensagem com erro
    for (const page of data.pages) {
      const failedMsg = page.messages.find(
        (m) => m._tempId === tempId && m._status === "error"
      );
      if (failedMsg) {
        // Reenviar
        sendMessageMutation.mutate({
          content: failedMsg.content,
          isInternal: failedMsg.isInternal || false,
          _tempId: crypto.randomUUID(), // Novo tempId
        });

        // Remover mensagem antiga com erro
        queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
          queryKey,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                messages: p.messages.filter((m) => m._tempId !== tempId),
              })),
            };
          }
        );
        break;
      }
    }
  }, [selectedConversation, sendMessageMutation]);

  /**
   * Edit message mutation
   */
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: number; content: string }) => {
      return conversationsApi.editMessage(messageId, content);
    },
    onMutate: async ({ messageId, content }) => {
      if (!selectedConversation) return;

      const queryKey = ["/api/conversations", selectedConversation.id, "messages"];
      await queryClient.cancelQueries({ queryKey });

      const previousMessages = queryClient.getQueryData<{ pages: Array<{ messages: InboxMessage[] }> }>(queryKey);

      // Optimistic update
      queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, content, editedAt: new Date() }
                  : msg
              ),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMessages && selectedConversation) {
        const queryKey = ["/api/conversations", selectedConversation.id, "messages"];
        queryClient.setQueryData(queryKey, context.previousMessages);
      }
      toast({
        title: t("toast.error"),
        description: "Failed to edit message",
        variant: "destructive",
      });
    },
  });

  /**
   * Delete message mutation
   */
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return conversationsApi.deleteMessage(messageId);
    },
    onMutate: async (messageId) => {
      if (!selectedConversation) return;

      const queryKey = ["/api/conversations", selectedConversation.id, "messages"];
      await queryClient.cancelQueries({ queryKey });

      const previousMessages = queryClient.getQueryData<{ pages: Array<{ messages: InboxMessage[] }> }>(queryKey);

      // Optimistic update - mark as deleted
      queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, deletedAt: new Date() }
                  : msg
              ),
            })),
          };
        }
      );

      return { previousMessages };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMessages && selectedConversation) {
        const queryKey = ["/api/conversations", selectedConversation.id, "messages"];
        queryClient.setQueryData(queryKey, context.previousMessages);
      }
      toast({
        title: t("toast.error"),
        description: "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  /**
   * Handle edit message
   */
  const handleEditMessage = useCallback(async (messageId: number, content: string) => {
    await editMessageMutation.mutateAsync({ messageId, content });
  }, [editMessageMutation]);

  /**
   * Handle delete message
   */
  const handleDeleteMessage = useCallback(async (messageId: number) => {
    await deleteMessageMutation.mutateAsync(messageId);
  }, [deleteMessageMutation]);

  /**
   * Handle message selection from search results
   * Navigate to the conversation containing the selected message
   */
  const handleSelectSearchResult = useCallback((result: MessageSearchResult) => {
    if (!conversations) return;

    // Find the conversation that contains this message
    const conversation = conversations.find((c) => c.id === result.conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
      // TODO: In the future, we could scroll to the specific message
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

      // Cmd/Ctrl+F to open search modal (override browser's default)
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchModalOpen(true);
        return;
      }

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

      // Escape to deselect conversation (go back to list)
      if (e.key === "Escape" && !isTyping && selectedConversationRef.current) {
        e.preventDefault();
        setSelectedConversation(null);
        return;
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

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && pendingFiles.length === 0) return;
    if (!selectedConversation || !user) return;

    const messageContent = newMessage || (pendingFiles.length > 0 ? "[Attachment]" : "");
    const tempId = crypto.randomUUID();

    // If offline, queue the message for later sync
    if (!isOnline || !wsConnected) {
      const offlineMsg = await queueMessage({
        conversationId: selectedConversation.id,
        content: messageContent,
        isInternal: isInternalComment,
        replyToId: replyingTo?.id ?? null,
      });

      // Add queued message to cache for immediate UI feedback
      const queryKey = ["/api/conversations", selectedConversation.id, "messages"];
      const queuedMessage: InboxMessage = {
        id: -Date.now(),
        conversationId: selectedConversation.id,
        senderId: user.id,
        senderType: "user",
        content: messageContent,
        contentType: "text",
        isInternal: isInternalComment,
        attachments: null,
        metadata: null,
        mentions: null,
        readBy: [user.id],
        externalId: null,
        replyToId: replyingTo?.id ?? null,
        createdAt: new Date(),
        editedAt: null,
        deletedAt: null,
        originalContent: null,
        _status: "queued",
        _tempId: tempId,
        _offlineId: offlineMsg.id,
      };

      queryClient.setQueryData<{ pages: Array<{ messages: InboxMessage[]; nextCursor: number | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKey,
        (old) => {
          if (!old || !old.pages || old.pages.length === 0) {
            return {
              pages: [{ messages: [queuedMessage], nextCursor: null, hasMore: false }],
              pageParams: [undefined],
            };
          }
          const newPages = [...old.pages];
          const lastPageIndex = newPages.length - 1;
          newPages[lastPageIndex] = {
            ...newPages[lastPageIndex],
            messages: [...newPages[lastPageIndex].messages, queuedMessage],
          };
          return { ...old, pages: newPages };
        }
      );

      clearMessageState();
      toast({
        title: t("inbox.offlineQueue.queued"),
        description: t("inbox.offlineQueue.willSync"),
      });
      return;
    }

    // Online: send normally with optimistic update
    sendMessageMutation.mutate({
      content: messageContent,
      isInternal: isInternalComment,
      attachments: pendingFiles.filter((f) => f.status === "uploaded"),
      replyToId: replyingTo?.id ?? null,
      _tempId: tempId,
    });
  }, [newMessage, pendingFiles, isInternalComment, replyingTo, sendMessageMutation, isOnline, wsConnected, selectedConversation, user, queueMessage, clearMessageState, toast, t]);

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
              onSearchClick={() => setSearchModalOpen(true)}
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
