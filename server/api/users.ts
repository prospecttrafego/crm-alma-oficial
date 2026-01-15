import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { asyncHandler, validateBody, getCurrentUser } from "../middleware";
import { updateUserProfileSchema } from "../validation";
import { sendSuccess, sendNotFound, toSafeUser } from "../response";

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
    asyncHandler(async (req, res) => {
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
