import { useEffect, useRef } from "react";

import { useWebSocketContext } from "@/contexts/WebSocketContext";

/**
 * Subscribes the current WebSocket connection to a conversation-specific room.
 * Ensures we only receive real-time events for the active conversation.
 */
export function useConversationRoom(conversationId: number | null) {
  const { send, isConnected } = useWebSocketContext();
  const previousConversationIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    const previousConversationId = previousConversationIdRef.current;
    if (previousConversationId && previousConversationId !== conversationId) {
      send("room:leave", { conversationId: previousConversationId });
    }

    if (conversationId && conversationId !== previousConversationId) {
      send("room:join", { conversationId });
      previousConversationIdRef.current = conversationId;
      return;
    }

    if (!conversationId) {
      previousConversationIdRef.current = null;
    }
  }, [conversationId, isConnected, send]);

  useEffect(() => {
    return () => {
      const conversationToLeave = previousConversationIdRef.current;
      if (conversationToLeave) {
        send("room:leave", { conversationId: conversationToLeave });
      }
    };
  }, [send]);
}

