import type { Server as HttpServer } from "http";
import type { RequestHandler } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";
import { setUserOffline, setUserOnline } from "../redis";

const clients = new Set<WebSocket>();
const HEARTBEAT_INTERVAL_MS = 30000;

export function broadcast(type: string, data: unknown) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
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

    try {
      const user = await storage.getUser(userId);
      const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined;
      await setUserOnline(userId);
      broadcast("user:online", { userId, userName, lastSeenAt: new Date().toISOString() });
    } catch (error) {
      console.error("WebSocket online status error:", error);
    }

    ws.on("pong", async () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
      try {
        await setUserOnline(userId);
      } catch (error) {
        console.error("WebSocket presence refresh error:", error);
      }
    });

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "typing") {
          broadcast("typing", { ...data.payload, userId });
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", async () => {
      clients.delete(ws);
      clientUserMap.delete(ws);

      const hasOtherConnections = Array.from(clientUserMap.values()).includes(userId);
      if (hasOtherConnections) return;

      try {
        await setUserOffline(userId);
      } catch (error) {
        console.error("WebSocket offline status error:", error);
      }

      broadcast("user:offline", { userId, lastSeenAt: new Date().toISOString() });
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
}
