import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type { VirtuosoHandle } from "react-virtuoso";

import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket, useConversationRoom } from "@/hooks/useWebSocket";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  conversationsApi,
  type ConversationWithRelations,
  type MessagesResponse,
} from "@/lib/api/conversations";
import { filesApi } from "@/lib/api/files";
import { emailTemplatesApi } from "@/lib/api/emailTemplates";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { EmailTemplate } from "@shared/schema";
import { ConversationListPanel } from "@/pages/inbox/components/ConversationListPanel";
import { ContextPanel } from "@/pages/inbox/components/ContextPanel";
import { EmptyState } from "@/pages/inbox/components/EmptyState";
import { MessageComposer } from "@/pages/inbox/components/MessageComposer";
import { MessageList } from "@/pages/inbox/components/MessageList";
import { ThreadHeader } from "@/pages/inbox/components/ThreadHeader";
import { TypingIndicator } from "@/pages/inbox/components/TypingIndicator";
import type { PendingFile, TypingUser, InboxMessage } from "@/pages/inbox/types";
import { formatInboxTime, getChannelLabel, getStatusLabel, substituteVariables } from "@/pages/inbox/utils";
import type { InboxFilters } from "@/components/filter-panel";

export default function InboxPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [filters, setFilters] = useState<InboxFilters>({});
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Collapsible panels (desktop / large screens)
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notification sounds
  const { playMessageReceived, playMessageSent } = useNotificationSound();

  // WebSocket for real-time features with sound notifications
  const { sendTyping, getTypingUsers } = useWebSocket({
    onMessage: (message) => {
      // Play sound for new messages from others
      if (message.type === "message:created" && message.data) {
        const messageData = message.data as { senderId?: string; senderType?: string };
        // Only play sound if message is from contact or system (not from current user)
        if (messageData.senderType !== "user" || messageData.senderId !== user?.id) {
          playMessageReceived();
        }
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

  // Handle typing indicator - debounced
  const handleTyping = useCallback(() => {
    if (!selectedConversation || !user) return;

    // Send typing indicator
    sendTyping(selectedConversation.id, user.id, `${user.firstName} ${user.lastName}`);

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [selectedConversation, user, sendTyping]);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<ConversationWithRelations[]>({
    queryKey: ["/api/conversations"],
    queryFn: conversationsApi.list,
  });

  // Ref for Virtuoso to control scroll
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(10000);

  // Infinite query for messages with cursor-based pagination
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

  // Flatten messages from all pages (pages are in reverse order, newest first)
  const messages = messagesData?.pages
    ? messagesData.pages.flatMap((page) => page.messages)
    : [];

  // Handle loading more messages when scrolling to top
  const loadMoreMessages = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      const currentLength = messages.length;
      fetchNextPage().then(() => {
        // Calculate how many new messages were added
        const newLength = messagesData?.pages
          ? messagesData.pages.flatMap((p) => p.messages).length
          : 0;
        const diff = newLength - currentLength;
        if (diff > 0) {
          setFirstItemIndex((prev) => prev - diff);
        }
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages.length, messagesData]);

  // Reset firstItemIndex when conversation changes
  useEffect(() => {
    setFirstItemIndex(10000);
  }, [selectedConversation?.id]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (!selectedConversation?.id) return;

    // Mark as read after a short delay (ensures user actually viewed)
    const timeout = setTimeout(async () => {
      try {
        await conversationsApi.markAsRead(selectedConversation.id);
        // Refresh conversations to update unread count
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

  // Audio recording handlers
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (_error) {
      toast({ title: t("toast.error"), description: t("errors.generic"), variant: "destructive" });
    }
  }, [t, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  }, [isRecording]);

  const sendAudioMessage = useCallback(async () => {
    if (!audioBlob || !selectedConversation) return;

    try {
      // Upload audio file
      const { uploadURL } = await filesApi.getUploadUrl();

      await fetch(uploadURL, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": "audio/webm" },
      });

      // Create message with audio
      const messageData = await conversationsApi.sendMessage(selectedConversation.id, {
        content: "🎤 Mensagem de áudio",
        isInternal: isInternalComment,
      });

      // Attach audio file to message
      await filesApi.register({
        name: `audio_${Date.now()}.webm`,
        mimeType: "audio/webm",
        size: audioBlob.size,
        uploadURL,
        entityType: "message",
        entityId: messageData.id,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      setAudioBlob(null);
      setRecordingTime(0);
      playMessageSent();
      toast({ title: t("toast.saved") });
    } catch (_error) {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  }, [audioBlob, selectedConversation, isInternalComment, t, toast, playMessageSent]);

  const applyTemplate = (template: EmailTemplate) => {
    // Use top-level company from conversation (resolved from contact or deal)
    const company = selectedConversation?.company || selectedConversation?.contact?.company;
    const substitutedBody = substituteVariables(template.body, {
      contact: selectedConversation?.contact,
      deal: selectedConversation?.deal,
      company: company,
      user: user,
    });
    setNewMessage(substitutedBody);
    toast({ title: t("toast.updated") });
  };

  /**
   * Mutation com optimistic updates para envio de mensagens
   * A mensagem aparece imediatamente com status "sending"
   */
  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      isInternal: boolean;
      attachments?: PendingFile[];
      _tempId: string; // ID temporario para tracking
    }) => {
      if (!selectedConversation) throw new Error("No conversation selected");

      const messageData = await conversationsApi.sendMessage(selectedConversation.id, {
        content: data.content,
        isInternal: data.isInternal,
        // Enviar _tempId como externalId para idempotencia em retries
        externalId: data._tempId,
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
        createdAt: new Date(), // Date object, nao string
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

      setNewMessage("");
      setPendingFiles([]);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const newPendingFiles: PendingFile[] = [];

    for (const file of Array.from(selectedFiles)) {
      try {
        const { uploadURL } = await filesApi.getUploadUrl();

        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        newPendingFiles.push({
          id: crypto.randomUUID(),
          file,
          uploadURL,
          status: "uploaded",
        });
      } catch (error) {
        console.error("Upload error:", error);
        newPendingFiles.push({
          id: crypto.randomUUID(),
          file,
          status: "error",
        });
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (fileId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const filteredConversations = conversations?.filter((conv) => {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";
      
      if (e.key === "j" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversations || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversation 
          ? list.findIndex((c) => c.id === selectedConversation.id)
          : -1;
        const nextIndex = currentIndex < list.length - 1 ? currentIndex + 1 : currentIndex;
        if (list[nextIndex]) {
          setSelectedConversation(list[nextIndex]);
        }
      }
      
      if (e.key === "k" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversations || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversation 
          ? list.findIndex((c) => c.id === selectedConversation.id)
          : list.length;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (list[prevIndex]) {
          setSelectedConversation(list[prevIndex]);
        }
      }
      
      if (!selectedConversation) return;
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
  }, [selectedConversation, filteredConversations]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && pendingFiles.length === 0) return;
    sendMessageMutation.mutate({
      content: newMessage || (pendingFiles.length > 0 ? "[Attachment]" : ""),
      isInternal: isInternalComment,
      attachments: pendingFiles.filter((f) => f.status === "uploaded"),
      _tempId: crypto.randomUUID(), // ID temporario para tracking de optimistic update
    });
  };

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
          filteredConversations={filteredConversations || []}
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
                onRetryMessage={retryMessage}
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
