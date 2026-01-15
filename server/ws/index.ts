import type { Server as HttpServer } from "http";
import type { RequestHandler } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";
import { setUserOffline, setUserOnline } from "../redis";
import { createServiceLogger } from "../logger";

const wsLogger = createServiceLogger("websocket");

const clients = new Set<WebSocket>();
const HEARTBEAT_INTERVAL_MS = 30000;

// ===== ROOM SYSTEM =====
// Map de conversationId -> Set de WebSockets inscritos naquela conversa
const conversationRooms = new Map<number, Set<WebSocket>>();

// Map de userId -> Set de WebSockets (para broadcast direcionado por usuario)
const userRooms = new Map<string, Set<WebSocket>>();

/**
 * Broadcast global para todos os clientes conectados
 * Usado para eventos globais como presence (online/offline)
 */
export function broadcast(type: string, data: unknown) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Broadcast direcionado para uma conversa especifica
 * Somente clientes inscritos naquela conversa receberao a mensagem
 */
export function broadcastToConversation(conversationId: number, type: string, data: unknown) {
  const room = conversationRooms.get(conversationId);
  if (!room || room.size === 0) {
    // Fallback para broadcast global se ninguem esta inscrito
    // (util durante transicao para o novo sistema)
    broadcast(type, data);
    return;
  }

  const message = JSON.stringify({ type, data });
  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Broadcast direcionado para um usuario especifico (todos os seus dispositivos)
 */
export function broadcastToUser(userId: string, type: string, data: unknown) {
  const room = userRooms.get(userId);
  if (!room || room.size === 0) return;

  const message = JSON.stringify({ type, data });
  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Inscrever WebSocket em uma room de conversa
 */
function joinConversationRoom(ws: WebSocket, conversationId: number) {
  if (!conversationRooms.has(conversationId)) {
    conversationRooms.set(conversationId, new Set());
  }
  conversationRooms.get(conversationId)!.add(ws);
}

/**
 * Desinscrever WebSocket de uma room de conversa
 */
function leaveConversationRoom(ws: WebSocket, conversationId: number) {
  const room = conversationRooms.get(conversationId);
  if (room) {
    room.delete(ws);
    // Limpar room vazia
    if (room.size === 0) {
      conversationRooms.delete(conversationId);
    }
  }
}

/**
 * Desinscrever WebSocket de todas as rooms de conversa
 */
function leaveAllConversationRooms(ws: WebSocket) {
  conversationRooms.forEach((room, conversationId) => {
    room.delete(ws);
    if (room.size === 0) {
      conversationRooms.delete(conversationId);
    }
  });
}

/**
 * Adicionar WebSocket ao room de usuario
 */
function addToUserRoom(ws: WebSocket, userId: string) {
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set());
  }
  userRooms.get(userId)!.add(ws);
}

/**
 * Remover WebSocket do room de usuario
 */
function removeFromUserRoom(ws: WebSocket, userId: string) {
  const room = userRooms.get(userId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      userRooms.delete(userId);
    }
  }
}

/**
 * WebSocket server (upgrade em `/ws`) autenticado via cookie de sessao.
 * Evita spoofing de `userId` porque valida o userId via `session.passport.user`.
 */
export function setupWebSocketServer(httpServer: HttpServer, sessionParser: RequestHandler) {
  const wss = new WebSocketServer({ noServer: true });
  const clientUserMap = new Map<WebSocket, string>();
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client) => {
      const trackedClient = client as WebSocket & { isAlive?: boolean };
      if (trackedClient.isAlive === false) {
        client.terminate();
        return;
      }
      trackedClient.isAlive = false;
      client.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  const fakeRes = {
    getHeader() {
      return undefined;
    },
    setHeader() {},
  } as any;

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ? new URL(req.url, "http://localhost") : null;
    if (!url || url.pathname !== "/ws") {
      if (process.env.NODE_ENV === "production") {
        socket.destroy();
      }
      return;
    }

    sessionParser(req as any, fakeRes, () => {
      const userId = (req as any).session?.passport?.user as string | undefined;
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });
  });

  wss.on("connection", async (ws, req) => {
    const userId = (req as any).session?.passport?.user as string | undefined;
    if (!userId) {
      ws.close(1008, "Not authenticated");
      return;
    }

    clients.add(ws);
    clientUserMap.set(ws, userId);
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;

    // Adicionar ao room do usuario para broadcasts direcionados
    addToUserRoom(ws, userId);

    try {
      const user = await storage.getUser(userId);
      const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined;
      await setUserOnline(userId);
      broadcast("user:online", { userId, userName, lastSeenAt: new Date().toISOString() });
    } catch (error) {
      wsLogger.error("WebSocket online status error", { error });
    }

    ws.on("pong", async () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
      try {
        await setUserOnline(userId);
      } catch (error) {
        wsLogger.error("WebSocket presence refresh error", { error });
      }
    });

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // ===== ROOM MANAGEMENT =====
        // Cliente se inscreve em uma conversa para receber mensagens direcionadas
        if (data.type === "room:join") {
          const { conversationId } = data.payload as { conversationId: number };
          if (typeof conversationId === "number") {
            joinConversationRoom(ws, conversationId);
          }
          return;
        }

        // Cliente sai de uma room de conversa
        if (data.type === "room:leave") {
          const { conversationId } = data.payload as { conversationId: number };
          if (typeof conversationId === "number") {
            leaveConversationRoom(ws, conversationId);
          }
          return;
        }

        // ===== TYPING INDICATOR =====
        // Agora usa broadcast direcionado para a conversa especifica
        if (data.type === "typing") {
          const { conversationId } = data.payload as { conversationId?: number };
          if (conversationId) {
            broadcastToConversation(conversationId, "typing", { ...data.payload, userId });
          } else {
            // Fallback para broadcast global se nao tiver conversationId
            broadcast("typing", { ...data.payload, userId });
          }
          return;
        }
      } catch (error) {
        wsLogger.error("WebSocket message error", { error });
      }
    });

    ws.on("close", async () => {
      clients.delete(ws);
      clientUserMap.delete(ws);

      // Limpar todas as inscricoes de rooms
      leaveAllConversationRooms(ws);
      removeFromUserRoom(ws, userId);

      const hasOtherConnections = Array.from(clientUserMap.values()).includes(userId);
      if (hasOtherConnections) return;

      try {
        await setUserOffline(userId);
      } catch (error) {
        wsLogger.error("WebSocket offline status error", { error });
      }

      broadcast("user:offline", { userId, lastSeenAt: new Date().toISOString() });
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
}
