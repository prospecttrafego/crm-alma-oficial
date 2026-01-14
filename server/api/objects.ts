import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { ObjectStorageService, ObjectNotFoundError, ObjectPermission } from "../integrations/supabase/storage";
import { asyncHandler, getCurrentUser } from "../middleware";
import { sendUnauthorized, sendNotFound } from "../response";

export function registerObjectRoutes(app: Express) {
  // Serve object files
  app.get(
    "/objects/:objectPath(*)",
    isAuthenticated,
    asyncHandler(async (req, res) => {
      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id;
      const objectStorageService = new ObjectStorageService();

      try {
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        const canAccess = await objectStorageService.canAccessObjectEntity({
          objectFile,
          userId: userId,
          requestedPermission: ObjectPermission.READ,
        });

        if (!canAccess) {
          return sendUnauthorized(res, "Access denied to object");
        }

        await objectStorageService.downloadObject(objectFile.path, res);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return sendNotFound(res, "Object not found");
        }
        throw error;
      }
    })
  );
}
