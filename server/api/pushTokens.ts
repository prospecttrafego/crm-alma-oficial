import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

export function registerPushTokenRoutes(app: Express) {
  // Push token endpoints for FCM
  app.post("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { token, deviceInfo } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const pushToken = await storage.createPushToken({
        userId,
        token,
        deviceInfo: deviceInfo || null,
      });

      res.status(201).json(pushToken);
    } catch (error) {
      console.error("Error saving push token:", error);
      res.status(500).json({ message: "Failed to save push token" });
    }
  });

  app.delete("/api/push-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      await storage.deletePushToken(token);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting push token:", error);
      res.status(500).json({ message: "Failed to delete push token" });
    }
  });
}

