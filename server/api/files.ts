import type { Express } from "express";
import { z } from "zod";
import { fileEntityTypes, type FileEntityType } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { ObjectStorageService } from "../integrations/supabase/storage";
import { enqueueJob } from "../jobs/queue";
import { JobTypes, type TranscribeAudioPayload } from "../jobs/handlers";
import { asyncHandler, validateBody, validateParams, validateQuery, getCurrentUser } from "../middleware";
import { createFileSchema } from "../validation";
import { sendSuccess, sendNotFound, sendValidationError, sendServiceUnavailable } from "../response";
import { logger } from "../logger";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "../constants";

const fileEntityParamsSchema = z.object({
  entityType: z.string(),
  entityId: z.coerce.number().int().positive(),
});

const fileIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const transcribeBodySchema = z.object({
  audioUrl: z.string().optional(),
  language: z.string().optional(),
});

const asyncQuerySchema = z.object({
  async: z.string().optional(),
});

export function registerFileRoutes(app: Express) {
  // File upload - get presigned URL
  app.post(
    "/api/files/upload-url",
    isAuthenticated,
    asyncHandler(async (_req, res) => {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
      sendSuccess(res, { uploadURL, objectPath });
    })
  );

  // Register uploaded file
  app.post(
    "/api/files",
    isAuthenticated,
    validateBody(createFileSchema),
    asyncHandler(async (req, res) => {
      const org = await storage.getDefaultOrganization();
      if (!org) {
        return sendValidationError(res, "No organization found");
      }

      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;
      const { name, mimeType, size, uploadURL, objectPath, entityType, entityId } = req.validatedBody;

      if (!uploadURL && !objectPath) {
        return sendValidationError(res, "Either uploadURL or objectPath is required");
      }

      // Validate file size (50MB limit)
      if (size && size > MAX_FILE_SIZE_BYTES) {
        return sendValidationError(
          res,
          `Arquivo muito grande. O tamanho máximo permitido é ${MAX_FILE_SIZE_MB}MB.`,
          [{ path: "size", message: `O arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB` }]
        );
      }

      if (!fileEntityTypes.includes(entityType as FileEntityType)) {
        return sendValidationError(res, "Invalid entity type");
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedObjectPath = await objectStorageService.trySetObjectEntityAclPolicy(objectPath || uploadURL, {
        owner: userId,
        visibility: "public",
      });

      if (!normalizedObjectPath.startsWith("/objects/")) {
        return sendValidationError(res, "Invalid object path");
      }

      const file = await storage.createFile({
        name,
        mimeType: mimeType || null,
        size: size || null,
        objectPath: normalizedObjectPath,
        entityType: entityType as FileEntityType,
        entityId: typeof entityId === "string" ? parseInt(entityId) : entityId,
        organizationId: org.id,
        uploadedBy: userId,
      });

      // Audit log for file upload
      await storage.createAuditLog({
        userId,
        action: "create",
        entityType: "file",
        entityId: file.id,
        entityName: file.name,
        organizationId: org.id,
        changes: {
          after: {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            linkedTo: `${entityType}:${entityId}`,
          },
        },
      });

      sendSuccess(res, file, 201);
    })
  );

  // Get files for entity
  app.get(
    "/api/files/:entityType/:entityId",
    isAuthenticated,
    validateParams(fileEntityParamsSchema),
    asyncHandler(async (req, res) => {
      const { entityType, entityId } = req.validatedParams;

      if (!fileEntityTypes.includes(entityType as FileEntityType)) {
        return sendValidationError(res, "Invalid entity type");
      }

      const files = await storage.getFiles(entityType as FileEntityType, entityId);
      sendSuccess(res, files);
    })
  );

  // Delete file
  app.delete(
    "/api/files/:id",
    isAuthenticated,
    validateParams(fileIdParamsSchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const currentUser = getCurrentUser(req);
      const userId = currentUser!.id;

      const file = await storage.getFile(id);
      if (!file) {
        return sendNotFound(res, "File not found");
      }

      // Best-effort delete from storage
      try {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
        await objectStorageService.deleteFile(objectFile.path);
      } catch (e) {
        logger.warn("Failed to delete object from storage (continuing)", { error: e });
      }

      await storage.deleteFile(id);

      // Audit log for file deletion
      await storage.createAuditLog({
        userId,
        action: "delete",
        entityType: "file",
        entityId: id,
        entityName: file.name,
        organizationId: file.organizationId,
        changes: {
          before: {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            linkedTo: `${file.entityType}:${file.entityId}`,
          },
        },
      });

      res.status(204).send();
    })
  );

  // Audio transcription endpoint
  app.post(
    "/api/audio/transcribe",
    isAuthenticated,
    validateBody(transcribeBodySchema),
    validateQuery(asyncQuerySchema),
    asyncHandler(async (req, res) => {
      const { audioUrl, language } = req.validatedBody;
      const isAsync = req.validatedQuery?.async === "true";

      if (!audioUrl) {
        return sendValidationError(res, "Audio URL is required");
      }

      const { isWhisperAvailable } = await import("../integrations/openai/whisper");

      if (!isWhisperAvailable()) {
        return sendServiceUnavailable(res, "Transcription service not available");
      }

      let resolvedUrl: string = audioUrl;
      if (typeof audioUrl === "string" && audioUrl.startsWith("/objects/")) {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(audioUrl);
        resolvedUrl = await objectStorageService.getSignedUrl(objectFile.path, 15 * 60);
      }

      // Async mode: queue the job
      if (isAsync) {
        const payload: TranscribeAudioPayload = {
          audioUrl: resolvedUrl,
          language,
        };

        const job = await enqueueJob(JobTypes.TRANSCRIBE_AUDIO, payload);

        return sendSuccess(
          res,
          {
            message: "Transcription queued",
            jobId: job.id,
            status: job.status,
          },
          202
        );
      }

      // Sync mode: transcribe immediately
      const { transcribeAudio } = await import("../integrations/openai/whisper");
      const result = await transcribeAudio(resolvedUrl, language);
      sendSuccess(res, result);
    })
  );

  // Transcribe audio file by ID (fetches file URL and transcribes)
  app.post(
    "/api/files/:id/transcribe",
    isAuthenticated,
    validateParams(fileIdParamsSchema),
    validateBody(transcribeBodySchema),
    validateQuery(asyncQuerySchema),
    asyncHandler(async (req, res) => {
      const { id } = req.validatedParams;
      const isAsync = req.validatedQuery?.async === "true";

      const file = await storage.getFile(id);
      if (!file) {
        return sendNotFound(res, "File not found");
      }

      // Check if file is audio
      if (!file.mimeType?.startsWith("audio/")) {
        return sendValidationError(res, "File is not an audio file");
      }

      const { isWhisperAvailable } = await import("../integrations/openai/whisper");

      if (!isWhisperAvailable()) {
        return sendServiceUnavailable(res, "Transcription service not available");
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
      const signedUrl = await objectStorageService.getSignedUrl(objectFile.path, 15 * 60);

      // Async mode: queue the job
      if (isAsync) {
        const payload: TranscribeAudioPayload = {
          audioUrl: signedUrl,
          language: req.validatedBody?.language,
          fileId: id,
        };

        const job = await enqueueJob(JobTypes.TRANSCRIBE_AUDIO, payload);

        return sendSuccess(
          res,
          {
            message: "Transcription queued",
            jobId: job.id,
            status: job.status,
            fileId: id,
            fileName: file.name,
          },
          202
        );
      }

      // Sync mode: transcribe immediately
      const { transcribeAudio } = await import("../integrations/openai/whisper");
      const result = await transcribeAudio(signedUrl, req.validatedBody?.language);

      // Return transcription result
      sendSuccess(res, {
        ...result,
        fileId: id,
        fileName: file.name,
      });
    })
  );
}
