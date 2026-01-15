import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { ObjectStorageService, ObjectNotFoundError, ObjectPermission } from "../integrations/supabase/storage";
import { asyncHandler, getCurrentUser, validateParams } from "../middleware";
import { sendUnauthorized, sendNotFound, sendSuccess } from "../response";
import { SIGNED_URL_EXPIRY_SECONDS } from "../constants";

const fileIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerObjectRoutes(app: Express) {
  /**
   * Get signed URL for a file by ID
   * Returns a temporary URL that expires after 1 hour
   * This is the preferred method for accessing files
   */
  app.get(
    "/api/files/:id/signed-url",
    isAuthenticated,
    validateParams(fileIdParamsSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const currentUser = getCurrentUser(req);
      const userId = currentUser?.id;

      const { storage } = await import("../storage");
      const file = await storage.getFile(id);

      if (!file) {
        return sendNotFound(res, "File not found");
      }

      const objectStorageService = new ObjectStorageService();

      try {
        const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
        const canAccess = await objectStorageService.canAccessObjectEntity({
          objectFile,
          userId: userId,
          requestedPermission: ObjectPermission.READ,
        });

        if (!canAccess) {
          return sendUnauthorized(res, "Access denied to file");
        }

        // Generate signed URL with 1-hour expiration
        const signedUrl = await objectStorageService.getSignedUrl(
          objectFile.path,
          SIGNED_URL_EXPIRY_SECONDS
        );

        sendSuccess(res, {
          signedUrl,
          expiresIn: SIGNED_URL_EXPIRY_SECONDS,
          fileName: file.name,
          mimeType: file.mimeType,
          size: file.size,
        });
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return sendNotFound(res, "File not found in storage");
        }
        throw error;
      }
    })
  );

  /**
   * Direct file download by object path
   * @deprecated Use GET /api/files/:id/signed-url instead for better security
   */
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

        await objectStorageService.downloadObject(objectFile.path, res, SIGNED_URL_EXPIRY_SECONDS);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return sendNotFound(res, "Object not found");
        }
        throw error;
      }
    })
  );
}
