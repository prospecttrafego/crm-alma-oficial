import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { ObjectStorageService, ObjectNotFoundError, ObjectPermission } from "../storage.supabase";

export function registerObjectRoutes(app: Express) {
  // Serve object files
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any)?.id;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      await objectStorageService.downloadObject(objectFile.path, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });
}

