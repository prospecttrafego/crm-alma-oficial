/**
 * Hook para conexao WebSocket com reconexao automatica
 * e invalidacao de queries baseada em eventos
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { queryClient } from "@/lib/queryClient";

// Tipos de eventos do servidor
export type WebSocketEventType =
  | "pipeline:created"
  | "pipeline:updated"
  | "pipeline:deleted"
  | "pipeline:stage:created"
  | "pipeline:stage:updated"
  | "pipeline:stage:deleted"
  | "deal:created"
  | "deal:updated"
  | "deal:moved"
  | "deal:deleted"
  | "conversation:created"
  | "message:created"
  | "message:updated"
  | "message:deleted"
  | "notification:new"
  | "calendar:event:created"
  | "calendar:event:updated"
  | "calendar:event:deleted"
  | "channel:config:created"
  | "channel:config:updated"
  | "channel:config:deleted"
  | "typing"
  | "user:online"
  | "user:offline"
  | "message:read";

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  data: T;
}

export interface TypingPayload {
  conversationId: number;
  userId: string;
  userName?: string;
}

export interface PresencePayload {
  userId: string;
  lastSeenAt?: string;
}

interface UseWebSocketOptions {
  userId?: string;
  userName?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onTyping?: (payload: TypingPayload) => void;
  onPresence?: (payload: PresencePayload, isOnline: boolean) => void;
  autoInvalidate?: boolean;
}

// Mapeamento de eventos para queries a invalidar
const eventToQueryMap: Record<string, string[]> = {
  "pipeline:created": ["/api/pipelines"],
  "pipeline:updated": ["/api/pipelines"],
  "pipeline:deleted": ["/api/pipelines"],
  "pipeline:stage:created": ["/api/pipelines"],
  "pipeline:stage:updated": ["/api/pipelines"],
  "pipeline:stage:deleted": ["/api/pipelines"],
  "deal:created": ["/api/deals", "/api/pipelines"],
  "deal:updated": ["/api/deals"],
  "deal:moved": ["/api/deals"],
  "deal:deleted": ["/api/deals"],
  "conversation:created": ["/api/conversations"],
  "message:created": ["/api/conversations"],
  "notification:new": ["/api/notifications", "/api/notifications/unread-count"],
  "calendar:event:created": ["/api/calendar-events"],
  "calendar:event:updated": ["/api/calendar-events"],
  "calendar:event:deleted": ["/api/calendar-events"],
  "channel:config:created": ["/api/channel-configs"],
  "channel:config:updated": ["/api/channel-configs"],
  "channel:config:deleted": ["/api/channel-configs"],
};

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { userId, userName, onMessage, onTyping, onPresence, autoInvalidate = true } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<number, TypingPayload[]>>(new Map());

  // Limpar typing indicator apos 3 segundos
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearTypingTimeout = useCallback((key: string) => {
    const timeout = typingTimeoutsRef.current.get(key);
    if (timeout) {
      clearTimeout(timeout);
      typingTimeoutsRef.current.delete(key);
    }
  }, []);

  const handleTyping = useCallback((payload: TypingPayload) => {
    const key = `${payload.conversationId}-${payload.userId}`;

    // Atualizar estado de typing
    setTypingUsers((prev) => {
      const newMap = new Map(prev);
      const conversationTyping = newMap.get(payload.conversationId) || [];

      // Adicionar ou atualizar usuario
      const existingIndex = conversationTyping.findIndex((t) => t.userId === payload.userId);
      if (existingIndex >= 0) {
        conversationTyping[existingIndex] = payload;
      } else {
        conversationTyping.push(payload);
      }

      newMap.set(payload.conversationId, conversationTyping);
      return newMap;
    });

    // Limpar timeout anterior
    clearTypingTimeout(key);

    // Remover apos 3 segundos de inatividade
    const timeout = setTimeout(() => {
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        const conversationTyping = newMap.get(payload.conversationId) || [];
        const filtered = conversationTyping.filter((t) => t.userId !== payload.userId);

        if (filtered.length === 0) {
          newMap.delete(payload.conversationId);
        } else {
          newMap.set(payload.conversationId, filtered);
        }

        return newMap;
      });
    }, 3000);

    typingTimeoutsRef.current.set(key, timeout);

    onTyping?.(payload);
  }, [onTyping, clearTypingTimeout]);

  const connect = useCallback(() => {
    // Construir URL do WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Conectado");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send presence information if user is authenticated
        if (userId) {
          ws.send(JSON.stringify({
            type: "presence",
            payload: { userId, userName }
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Callback customizado
          onMessage?.(message);

          // Tratar typing separadamente
          if (message.type === "typing") {
            handleTyping(message.data as TypingPayload);
            return;
          }

          // Tratar presence
          if (message.type === "user:online" || message.type === "user:offline") {
            const presenceData = message.data as PresencePayload;
            const isOnline = message.type === "user:online";

            // Update online users set
            setOnlineUsers((prev) => {
              const newSet = new Set(prev);
              if (isOnline) {
                newSet.add(presenceData.userId);
              } else {
                newSet.delete(presenceData.userId);
              }
              return newSet;
            });

            onPresence?.(presenceData, isOnline);
            return;
          }

          // Auto-invalidar queries
          if (autoInvalidate) {
            // Para mensagens, fazer append DIRETO no cache (sem refetch!)
            if (message.type === "message:created" && message.data) {
              const newMessage = message.data as {
                id: number;
                conversationId: number;
                senderId?: string;
                senderType?: string;
                content: string;
                contentType?: string;
                isInternal?: boolean;
                createdAt: string;
                readBy?: string[];
                [key: string]: unknown;
              };

              if (newMessage.conversationId) {
                const queryKey = ["/api/conversations", newMessage.conversationId, "messages"];

                // Append direto no cache
                type MessageInCache = { id?: number; _tempId?: string };
                queryClient.setQueryData<{
                  pages: Array<{ messages: MessageInCache[]; nextCursor: number | null; hasMore: boolean }>;
                  pageParams: unknown[];
                }>(queryKey, (old) => {
                  if (!old || !old.pages || old.pages.length === 0) return old;

                  // Verificar se mensagem ja existe (evitar duplicata de msg otimista)
                  const lastPage = old.pages[old.pages.length - 1];
                  const exists = lastPage.messages.some(
                    (m) =>
                      m.id === newMessage.id ||
                      // Verificar se e a mesma mensagem otimista pelo conteudo e tempo
                      (m._tempId && Math.abs(new Date(newMessage.createdAt).getTime() - Date.now()) < 5000)
                  );

                  if (exists) return old;

                  // Append na ultima pagina
                  const newPages = [...old.pages];
                  const lastPageIndex = newPages.length - 1;
                  newPages[lastPageIndex] = {
                    ...newPages[lastPageIndex],
                    messages: [...newPages[lastPageIndex].messages, newMessage as MessageInCache],
                  };

                  return { ...old, pages: newPages };
                });

                // Atualizar lista de conversas (lastMessageAt, unreadCount)
                queryClient.setQueryData<Array<{ id: number; lastMessageAt?: string; unreadCount?: number; [key: string]: unknown }>>(
                  ["/api/conversations"],
                  (old) => {
                    if (!old) return old;
                    return old
                      .map((conv) =>
                        conv.id === newMessage.conversationId
                          ? {
                              ...conv,
                              lastMessageAt: newMessage.createdAt,
                              // Incrementar unreadCount se msg nao e do usuario atual
                              unreadCount:
                                newMessage.senderType === "contact"
                                  ? (conv.unreadCount || 0) + 1
                                  : conv.unreadCount,
                            }
                          : conv
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.lastMessageAt || 0).getTime() -
                          new Date(a.lastMessageAt || 0).getTime()
                      );
                  }
                );
              }
            } else if (message.type === "message:updated" && message.data) {
              // Handle edited message - update in cache
              const updatedMessage = message.data as {
                id: number;
                conversationId: number;
                content: string;
                editedAt: string;
                [key: string]: unknown;
              };

              if (updatedMessage.conversationId) {
                const queryKey = ["/api/conversations", updatedMessage.conversationId, "messages"];

                type MessageInCache = { id?: number; content?: string; editedAt?: string | null; [key: string]: unknown };
                queryClient.setQueryData<{
                  pages: Array<{ messages: MessageInCache[]; nextCursor: number | null; hasMore: boolean }>;
                  pageParams: unknown[];
                }>(queryKey, (old) => {
                  if (!old || !old.pages) return old;

                  const newPages = old.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((m) =>
                      m.id === updatedMessage.id
                        ? { ...m, content: updatedMessage.content, editedAt: updatedMessage.editedAt }
                        : m
                    ),
                  }));

                  return { ...old, pages: newPages };
                });
              }
            } else if (message.type === "message:deleted" && message.data) {
              // Handle deleted message - update in cache
              const deletedPayload = message.data as {
                id: number;
                conversationId: number;
                deletedAt: string;
              };

              if (deletedPayload.conversationId) {
                const queryKey = ["/api/conversations", deletedPayload.conversationId, "messages"];

                type MessageInCache = { id?: number; deletedAt?: string | null; [key: string]: unknown };
                queryClient.setQueryData<{
                  pages: Array<{ messages: MessageInCache[]; nextCursor: number | null; hasMore: boolean }>;
                  pageParams: unknown[];
                }>(queryKey, (old) => {
                  if (!old || !old.pages) return old;

                  const newPages = old.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((m) =>
                      m.id === deletedPayload.id
                        ? { ...m, deletedAt: deletedPayload.deletedAt }
                        : m
                    ),
                  }));

                  return { ...old, pages: newPages };
                });
              }
            } else {
              // Para outros eventos, usar invalidacao normal
              const queriesToInvalidate = eventToQueryMap[message.type];
              if (queriesToInvalidate) {
                queriesToInvalidate.forEach((queryKey) => {
                  queryClient.invalidateQueries({ queryKey: [queryKey] });
                });
              }
            }
          }
        } catch (error) {
          console.error("[WebSocket] Erro ao processar mensagem:", error);
        }
      };

      ws.onclose = () => {
        console.log("[WebSocket] Desconectado");
        setIsConnected(false);
        wsRef.current = null;

        // Reconexao com backoff exponencial
        const maxAttempts = 10;
        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[WebSocket] Reconectando em ${delay}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Erro:", error);
      };
    } catch (error) {
      console.error("[WebSocket] Erro ao conectar:", error);
    }
  }, [onMessage, onPresence, autoInvalidate, handleTyping, userId, userName]);

  // Enviar mensagem pelo WebSocket
  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // Enviar typing indicator
  const sendTyping = useCallback((conversationId: number, userId: string, userName?: string) => {
    send("typing", { conversationId, userId, userName });
  }, [send]);

  // Conectar ao montar
  useEffect(() => {
    connect();
    const typingTimeouts = typingTimeoutsRef.current;

    return () => {
      // Limpar ao desmontar
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Limpar todos os timeouts de typing
      typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [connect]);

  // Obter usuarios digitando em uma conversa
  const getTypingUsers = useCallback((conversationId: number): TypingPayload[] => {
    return typingUsers.get(conversationId) || [];
  }, [typingUsers]);

  // Check if a user is online
  const isUserOnline = useCallback((checkUserId: string): boolean => {
    return onlineUsers.has(checkUserId);
  }, [onlineUsers]);

  return {
    isConnected,
    send,
    sendTyping,
    getTypingUsers,
    typingUsers,
    onlineUsers,
    isUserOnline,
  };
}

// Hook singleton para uso global
let globalWsInstance: ReturnType<typeof useWebSocket> | null = null;

export function useGlobalWebSocket() {
  const ws = useWebSocket();

  useEffect(() => {
    globalWsInstance = ws;
    return () => {
      globalWsInstance = null;
    };
  }, [ws]);

  return ws;
}

export function getGlobalWebSocket() {
  return globalWsInstance;
}

/**
 * Hook para inscrever automaticamente em uma room de conversa.
 * Quando o usuario abre uma conversa, ele se inscreve para receber
 * apenas eventos daquela conversa especifica (mensagens, typing, etc.)
 *
 * Ao sair da conversa (ou desmontar o componente), a inscricao e cancelada.
 *
 * IMPORTANTE: Este hook deve ser usado em conjunto com useGlobalWebSocket
 * no componente pai (ex.: App.tsx). Ele depende do singleton global.
 */
export function useConversationRoom(conversationId: number | null) {
  const previousConversationIdRef = useRef<number | null>(null);

  useEffect(() => {
    const ws = getGlobalWebSocket();
    if (!ws) return;

    const { send, isConnected } = ws;
    if (!isConnected) return;

    // Sair da room anterior se mudou de conversa
    if (previousConversationIdRef.current && previousConversationIdRef.current !== conversationId) {
      send("room:leave", { conversationId: previousConversationIdRef.current });
    }

    // Entrar na nova room
    if (conversationId) {
      send("room:join", { conversationId });
      previousConversationIdRef.current = conversationId;
    }

    return () => {
      // Sair da room ao desmontar
      if (conversationId && ws.isConnected) {
        ws.send("room:leave", { conversationId });
      }
    };
  }, [conversationId]);
}
