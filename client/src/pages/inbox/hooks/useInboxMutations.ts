import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { conversationsApi, type MessagesResponse } from "@/lib/api/conversations";
import { filesApi } from "@/lib/api/files";
import { queryClient } from "@/lib/queryClient";
import type { ConversationWithRelations } from "@/lib/api/conversations";
import type { PendingFile, InboxMessage } from "@/pages/inbox/types";

interface UseInboxMutationsOptions {
  selectedConversation: ConversationWithRelations | null;
  user: { id: string } | null;
  pendingFiles: PendingFile[];
  isInternalComment: boolean;
  replyingTo: InboxMessage | null;
  newMessage: string;
  clearMessageState: () => void;
  playMessageSent: () => void;
  isOnline: boolean;
  wsConnected: boolean;
  queueMessage: (payload: {
    conversationId: number;
    content: string;
    isInternal: boolean;
    replyToId?: number | null;
  }) => Promise<{ id: string }>;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useInboxMutations({
  selectedConversation,
  user,
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
}: UseInboxMutationsOptions) {
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
          if (pf.objectPath && pf.status === "uploaded") {
            await filesApi.register({
              name: pf.file.name,
              mimeType: pf.file.type,
              size: pf.file.size,
              objectPath: pf.objectPath,
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

      // If this is a reply, create a quotedMessage payload so the UI can render immediately
      const replyTo =
        newMessageData.replyToId && replyingTo?.id === newMessageData.replyToId
          ? {
              id: replyingTo.id,
              content: replyingTo.content,
              contentType: replyingTo.contentType ?? undefined,
              senderType: replyingTo.senderType ?? undefined,
              senderId: replyingTo.senderId ?? undefined,
              senderName:
                replyingTo.senderType === "user"
                  ? ([replyingTo.sender?.firstName, replyingTo.sender?.lastName].filter(Boolean).join(" ") ||
                      replyingTo.sender?.email ||
                      null)
                  : replyingTo.senderType === "system"
                    ? "System"
                    : t("inbox.contextPanel.contact"),
              createdAt: replyingTo.createdAt ?? undefined,
            }
          : null;

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
        replyTo,
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
    onSuccess: (serverMessage, _variables, context) => {
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
                  ? {
                      ...serverMessage,
                      // Preserve quoted payload when the server response doesn't include it
                      replyTo: msg.replyTo ?? null,
                      _status: "sent" as const,
                      _tempId: undefined,
                    } as InboxMessage
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
    onError: (error, _variables, context) => {
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
        variant: "destructive",
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
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              content: replyingTo.content,
              contentType: replyingTo.contentType ?? undefined,
              senderType: replyingTo.senderType ?? undefined,
              senderId: replyingTo.senderId ?? undefined,
              senderName:
                replyingTo.senderType === "user"
                  ? ([replyingTo.sender?.firstName, replyingTo.sender?.lastName].filter(Boolean).join(" ") ||
                      replyingTo.sender?.email ||
                      null)
                  : replyingTo.senderType === "system"
                    ? "System"
                    : t("inbox.contextPanel.contact"),
              createdAt: replyingTo.createdAt ?? undefined,
            }
          : null,
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

  return {
    sendMessageMutation,
    retryMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleSendMessage,
  };
}
