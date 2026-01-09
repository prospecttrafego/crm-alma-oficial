import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { toSafeUser } from "./utils";

export function registerUserRoutes(app: Express) {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      res.json(user ? toSafeUser(user) : user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update current user profile
  app.patch("/api/users/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const { firstName, lastName, profileImageUrl, preferences } = req.body;

      // Validate preferences if provided
      if (preferences && preferences.language) {
        if (!["pt-BR", "en"].includes(preferences.language)) {
          return res.status(400).json({ message: "Invalid language preference" });
        }
      }

      const updated = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        profileImageUrl,
        preferences,
      });

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(toSafeUser(updated));
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Get users for filter dropdown
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) return res.json([]);
      const usersList = await storage.getUsers(org.id);
      res.json(usersList.map(toSafeUser));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
}

