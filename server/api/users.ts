import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler, validateBody, getCurrentUser } from "../middleware";
import { sendSuccess, sendNotFound, toSafeUser } from "../response";

// Schemas de validacao
const updateUserProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().url().optional().nullable(),
  preferences: z
    .object({
      language: z.enum(["pt-BR", "en"]).optional(),
    })
    .optional(),
});

export function registerUserRoutes(app: Express) {
  // Get current user
  app.get(
    "/api/auth/user",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const user = await storage.getUser(currentUser!.id);
      sendSuccess(res, user ? toSafeUser(user) : null);
    })
  );

  // Update current user profile
  app.patch(
    "/api/users/me",
    isAuthenticated,
    validateBody(updateUserProfileSchema),
    asyncHandler(async (req: any, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const { firstName, lastName, profileImageUrl, preferences } = req.validatedBody;

      const updated = await storage.updateUserProfile(userId, {
        firstName,
        lastName,
        profileImageUrl,
        preferences,
      });

      if (!updated) {
        return sendNotFound(res, "User not found");
      }

      sendSuccess(res, toSafeUser(updated));
    })
  );

  // Get users for filter dropdown
  app.get(
    "/api/users",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) return sendSuccess(res, []);
      const usersList = await storage.getUsers(org.id);
      sendSuccess(res, usersList.map(toSafeUser));
    })
  );
}
