/**
 * Hook para conexao WebSocket com reconexao automatica
 * e invalidacao de queries baseada em eventos
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { onWebSocketReconnect } from "@/lib/offlineSync";

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
  | "conversation:updated"
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
  | "google_calendar:sync_complete"
  | "typing"
  | "user:online"
  | "user:offline";

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
// NOTE: Events with setQueryData handlers below are removed to avoid double invalidation
const eventToQueryMap: Record<string, string[]> = {
  // Pipeline events use setQueryData handlers - no invalidation needed
  // Deal events use setQueryData handlers - no invalidation needed
  // Channel config events use setQueryData handlers - no invalidation needed
  "conversation:created": ["/api/conversations"],
  // message:created, message:updated, message:deleted use setQueryData handlers
  // notification:new uses setQueryData + selective invalidation
  "calendar:event:created": ["/api/calendar-events"],
  "calendar:event:updated": ["/api/calendar-events"],
  "calendar:event:deleted": ["/api/calendar-events"],
  "google_calendar:sync_complete": ["/api/integrations/google-calendar/status", "/api/calendar-events"],
};

// Type for Pipeline with stages (matches API response)
interface PipelineStage {
  id: number;
  name: string;
  pipelineId: number;
  order: number;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
  createdAt: Date | string;
  [key: string]: unknown;
}

interface Pipeline {
  id: number;
  name: string;
  organizationId: number;
  isDefault: boolean;
  createdAt: Date | string;
  stages?: PipelineStage[];
  [key: string]: unknown;
}

// Type for Deal (matches API response)
interface Deal {
  id: number;
  title: string;
  value: string | number | null;
  currency: string;
  pipelineId: number;
  stageId: number;
  contactId: number | null;
  companyId: number | null;
  organizationId: number;
  ownerId: string | null;
  probability: number | null;
  expectedCloseDate: Date | string | null;
  status: string;
  source: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown;
}

// Type for Channel Config (matches API response)
interface ChannelConfig {
  id: number;
  name: string;
  type: string;
  organizationId: number;
  isActive: boolean;
  createdAt: Date | string;
  [key: string]: unknown;
}

function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  return 0;
}

/**
 * Establishes a WebSocket connection (`/ws`) with automatic reconnect and optional cache invalidation.
 *
 * The hook keeps local state for:
 * - Connection status (`isConnected`)
 * - Online users presence (`onlineUsers`)
 * - Typing indicators per conversation (`typingUsers`)
 *
 * When `autoInvalidate` is enabled, it invalidates known React Query keys based on server events.
 */
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
        const wasDisconnected = !wsRef.current || reconnectAttemptsRef.current > 0;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send presence information if user is authenticated
        if (userId) {
          ws.send(JSON.stringify({
            type: "presence",
            payload: { userId, userName }
          }));
        }

        // Trigger offline message sync on reconnect
        if (wasDisconnected) {
          onWebSocketReconnect().catch((error) => {
            console.error("[WebSocket] Error syncing offline messages:", error);
          });
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
                externalId?: string | null;
                [key: string]: unknown;
              };

              if (newMessage.conversationId) {
                const queryKey = ["/api/conversations", newMessage.conversationId, "messages"];

                // Append direto no cache
                type MessageInCache = { id?: number; _tempId?: string; externalId?: string | null; replyTo?: unknown };
                queryClient.setQueryData<{
                  pages: Array<{ messages: MessageInCache[]; nextCursor: number | null; hasMore: boolean }>;
                  pageParams: unknown[];
                }>(queryKey, (old) => {
                  if (!old || !old.pages || old.pages.length === 0) return old;

                  const externalId = newMessage.externalId ?? null;
                  let found = false;

                  // Replace optimistic message (matched by externalId == _tempId) or skip duplicates by id.
                  const newPages = old.pages.map((page) => ({
                    ...page,
                    messages: page.messages.map((m) => {
                      if (m.id === newMessage.id) {
                        found = true;
                        return m;
                      }

                      if (
                        !found &&
                        externalId &&
                        (m._tempId === externalId || (m.externalId && m.externalId === externalId))
                      ) {
                        found = true;
                        // Preserve quoted payload if we had it locally
                        return { ...(newMessage as MessageInCache), replyTo: m.replyTo };
                      }

                      return m;
                    }),
                  }));

                  if (found) {
                    return { ...old, pages: newPages };
                  }

                  // Append to the last page (newest chunk) when this is truly a new message.
                  const lastPageIndex = newPages.length - 1;
                  newPages[lastPageIndex] = {
                    ...newPages[lastPageIndex],
                    messages: [...newPages[lastPageIndex].messages, newMessage as MessageInCache],
                  };

                  return { ...old, pages: newPages };
                });

                // Atualizar lista de conversas (lastMessageAt, unreadCount)
                queryClient.setQueryData<
                  Array<{ id: number; lastMessageAt?: Date | string | null; unreadCount?: number; [key: string]: unknown }>
                >(
                  ["/api/conversations"],
                  (old) => {
                    if (!old) return old;
                    return old
                      .map((conv) =>
                        conv.id === newMessage.conversationId
                          ? {
                              ...conv,
                              lastMessageAt: new Date(newMessage.createdAt),
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
                          toTimestamp(b.lastMessageAt) - toTimestamp(a.lastMessageAt)
                      );
                  }
                );
              }
            } else if (message.type === "conversation:updated" && message.data) {
              const payload = message.data as {
                conversationId: number;
                lastMessageAt?: string | null;
                unreadCount?: number | null;
              };

              if (!payload.conversationId) return;

              queryClient.setQueryData<Array<{ id: number; lastMessageAt?: unknown; unreadCount?: number; [key: string]: unknown }>>(
                ["/api/conversations"],
                (old) => {
                  if (!old) return old;

                  const updatedLastMessageAt = payload.lastMessageAt ? new Date(payload.lastMessageAt) : undefined;
                  const updatedUnreadCount = typeof payload.unreadCount === "number" ? payload.unreadCount : undefined;

                  return old
                    .map((conv) =>
                      conv.id === payload.conversationId
                        ? {
                            ...conv,
                            ...(updatedLastMessageAt ? { lastMessageAt: updatedLastMessageAt } : {}),
                            ...(updatedUnreadCount !== undefined ? { unreadCount: updatedUnreadCount } : {}),
                          }
                        : conv,
                    )
                    .sort((a, b) => toTimestamp(b.lastMessageAt) - toTimestamp(a.lastMessageAt));
                },
              );
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
            } else if (message.type === "notification:new" && message.data) {
              // Handle notification:new with enriched payload (unreadCount)
              const payload = message.data as { unreadCount?: number };
              if (typeof payload.unreadCount === "number") {
                // Update unread count directly without refetch
                queryClient.setQueryData<{ count: number }>(
                  ["/api/notifications/unread-count"],
                  { count: payload.unreadCount }
                );
              }
              // Still invalidate notifications list to fetch new notification details
              queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
            }
            // ========== PIPELINE HANDLERS (setQueryData) ==========
            else if (message.type === "pipeline:created" && message.data) {
              const newPipeline = message.data as Pipeline;
              queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
                if (!old) return [newPipeline];
                // Avoid duplicates
                if (old.some((p) => p.id === newPipeline.id)) return old;
                return [...old, newPipeline];
              });
            } else if (message.type === "pipeline:updated" && message.data) {
              const updatedPipeline = message.data as Pipeline;
              queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
                if (!old) return old;
                return old.map((p) => (p.id === updatedPipeline.id ? { ...p, ...updatedPipeline } : p));
              });
            } else if (message.type === "pipeline:deleted" && message.data) {
              const payload = message.data as { id: number };
              queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
                if (!old) return old;
                return old.filter((p) => p.id !== payload.id);
              });
            } else if (message.type === "pipeline:stage:created" && message.data) {
              const newStage = message.data as PipelineStage;
              queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
                if (!old) return old;
                return old.map((p) => {
                  if (p.id !== newStage.pipelineId) return p;
                  const stages = p.stages || [];
                  if (stages.some((s) => s.id === newStage.id)) return p;
                  return { ...p, stages: [...stages, newStage].sort((a, b) => a.order - b.order) };
                });
              });
            } else if (message.type === "pipeline:stage:updated" && message.data) {
              const updatedStage = message.data as PipelineStage;
              queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
                if (!old) return old;
                return old.map((p) => {
                  if (p.id !== updatedStage.pipelineId) return p;
                  const stages = (p.stages || []).map((s) =>
                    s.id === updatedStage.id ? { ...s, ...updatedStage } : s
                  );
                  return { ...p, stages: stages.sort((a, b) => a.order - b.order) };
                });
              });
            } else if (message.type === "pipeline:stage:deleted" && message.data) {
              const payload = message.data as { id: number; pipelineId: number };
              queryClient.setQueryData<Pipeline[]>(["/api/pipelines"], (old) => {
                if (!old) return old;
                return old.map((p) => {
                  if (p.id !== payload.pipelineId) return p;
                  return { ...p, stages: (p.stages || []).filter((s) => s.id !== payload.id) };
                });
              });
            }
            // ========== DEAL HANDLERS (setQueryData) ==========
            else if (message.type === "deal:created" && message.data) {
              const newDeal = message.data as Deal;
              queryClient.setQueryData<Deal[]>(["/api/deals"], (old) => {
                if (!old) return [newDeal];
                if (old.some((d) => d.id === newDeal.id)) return old;
                return [...old, newDeal];
              });
            } else if (message.type === "deal:updated" && message.data) {
              const updatedDeal = message.data as Deal;
              queryClient.setQueryData<Deal[]>(["/api/deals"], (old) => {
                if (!old) return old;
                return old.map((d) => (d.id === updatedDeal.id ? { ...d, ...updatedDeal } : d));
              });
            } else if (message.type === "deal:moved" && message.data) {
              const movedDeal = message.data as { id: number; stageId: number; pipelineId?: number };
              queryClient.setQueryData<Deal[]>(["/api/deals"], (old) => {
                if (!old) return old;
                return old.map((d) =>
                  d.id === movedDeal.id
                    ? { ...d, stageId: movedDeal.stageId, ...(movedDeal.pipelineId && { pipelineId: movedDeal.pipelineId }) }
                    : d
                );
              });
            } else if (message.type === "deal:deleted" && message.data) {
              const payload = message.data as { id: number };
              queryClient.setQueryData<Deal[]>(["/api/deals"], (old) => {
                if (!old) return old;
                return old.filter((d) => d.id !== payload.id);
              });
            }
            // ========== CHANNEL CONFIG HANDLERS (setQueryData) ==========
            else if (message.type === "channel:config:created" && message.data) {
              const newConfig = message.data as ChannelConfig;
              queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
                if (!old) return [newConfig];
                if (old.some((c) => c.id === newConfig.id)) return old;
                return [...old, newConfig];
              });
            } else if (message.type === "channel:config:updated" && message.data) {
              const updatedConfig = message.data as ChannelConfig;
              queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
                if (!old) return old;
                return old.map((c) => (c.id === updatedConfig.id ? { ...c, ...updatedConfig } : c));
              });
            } else if (message.type === "channel:config:deleted" && message.data) {
              const payload = message.data as { id: number };
              queryClient.setQueryData<ChannelConfig[]>(["/api/channel-configs"], (old) => {
                if (!old) return old;
                return old.filter((c) => c.id !== payload.id);
              });
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
