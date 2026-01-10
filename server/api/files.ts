import type { Express } from "express";
import { fileEntityTypes, type FileEntityType } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { ObjectStorageService } from "../integrations/supabase/storage";

export function registerFileRoutes(app: Express) {
  // File upload - get presigned URL
  app.post("/api/files/upload-url", isAuthenticated, async (_req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Register uploaded file
  app.post("/api/files", isAuthenticated, async (req: any, res) => {
    try {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return res.status(400).json({ message: "No organization found" });
      }

      const userId = (req.user as any).id;
      const { name, mimeType, size, uploadURL, objectPath, entityType, entityId } = req.body;

      if (!name || (!uploadURL && !objectPath) || !entityType || !entityId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!fileEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedObjectPath = await objectStorageService.trySetObjectEntityAclPolicy(objectPath || uploadURL, {
        owner: userId,
        visibility: "public",
      });

      if (!normalizedObjectPath.startsWith("/objects/")) {
        return res.status(400).json({ message: "Invalid object path" });
      }

      const file = await storage.createFile({
        name,
        mimeType: mimeType || null,
        size: size || null,
        objectPath: normalizedObjectPath,
        entityType,
        entityId: parseInt(entityId),
        organizationId: org.id,
        uploadedBy: userId,
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Error registering file:", error);
      res.status(500).json({ message: "Failed to register file" });
    }
  });

  // Get files for entity
  app.get("/api/files/:entityType/:entityId", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;

      if (!fileEntityTypes.includes(entityType as FileEntityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }

      const files = await storage.getFiles(entityType as FileEntityType, parseInt(entityId));
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Delete file
  app.delete("/api/files/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Best-effort delete from storage
      try {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
        await objectStorageService.deleteFile(objectFile.path);
      } catch (e) {
        console.warn("Failed to delete object from storage (continuing):", e);
      }

      await storage.deleteFile(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Audio transcription endpoint
  app.post("/api/audio/transcribe", isAuthenticated, async (req: any, res) => {
    try {
      const { audioUrl, language } = req.body;

      if (!audioUrl) {
        return res.status(400).json({ message: "Audio URL is required" });
      }

      const { transcribeAudio, isWhisperAvailable } = await import("../integrations/openai/whisper");

      if (!isWhisperAvailable()) {
        return res.status(503).json({ message: "Transcription service not available" });
      }

      let resolvedUrl: string = audioUrl;
      if (typeof audioUrl === "string" && audioUrl.startsWith("/objects/")) {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(audioUrl);
        resolvedUrl = await objectStorageService.getSignedUrl(objectFile.path, 15 * 60);
      }

      const result = await transcribeAudio(resolvedUrl, language);
      res.json(result);
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });

  // Transcribe audio file by ID (fetches file URL and transcribes)
  app.post("/api/files/:id/transcribe", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check if file is audio
      if (!file.mimeType?.startsWith("audio/")) {
        return res.status(400).json({ message: "File is not an audio file" });
      }

      const { transcribeAudio, isWhisperAvailable } = await import("../integrations/openai/whisper");

      if (!isWhisperAvailable()) {
        return res.status(503).json({ message: "Transcription service not available" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
      const signedUrl = await objectStorageService.getSignedUrl(objectFile.path, 15 * 60);
      const result = await transcribeAudio(signedUrl, req.body.language);

      // Return transcription result
      // Note: To persist transcription, add a 'metadata' jsonb field to the files table
      res.json({
        ...result,
        fileId: id,
        fileName: file.name,
      });
    } catch (error) {
      console.error("Error transcribing file:", error);
      res.status(500).json({ message: "Failed to transcribe audio" });
    }
  });
}

