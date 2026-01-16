import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

import { useWebSocket, type WebSocketMessage } from "@/hooks/useWebSocket";

type WebSocketListener = (message: WebSocketMessage) => void;

type WebSocketContextValue = ReturnType<typeof useWebSocket> & {
  subscribe: (listener: WebSocketListener) => () => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({
  userId,
  userName,
  children,
}: {
  userId?: string;
  userName?: string;
  children: ReactNode;
}) {
  const listenersRef = useRef(new Set<WebSocketListener>());

  const subscribe = useCallback((listener: WebSocketListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const ws = useWebSocket({
    userId,
    userName,
    onMessage: (message) => {
      listenersRef.current.forEach((listener) => {
        try {
          listener(message);
        } catch (error) {
          console.error("[WebSocketProvider] Listener error", error);
        }
      });
    },
  });

  const value = useMemo(() => ({ ...ws, subscribe }), [ws, subscribe]);

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketContext(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketContext must be used within <WebSocketProvider />");
  }
  return ctx;
}
