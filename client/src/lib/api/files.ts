/**
 * Files API - upload and file management
 */

import { api } from "./client";
import { fileSchema, uploadUrlSchema, signedUrlSchema, transcriptionResultSchema } from "@shared/apiSchemas";
import type { File as FileRecord } from "@shared/schema";
import type { CreateFileDTO, TranscriptionResult } from "@shared/types";
import { z } from "zod";

export type RegisterFilePayload = CreateFileDTO;

export const filesApi = {
  getUploadUrl: (data?: { size?: number }) =>
    api.post<{ uploadURL: string; objectPath: string }>(
      "/api/files/upload-url",
      data ?? {},
      uploadUrlSchema
    ),

  register: (data: RegisterFilePayload) =>
    api.post<FileRecord>("/api/files", data, fileSchema),

  listByEntity: (entityType: string, entityId: number) =>
    api.get<FileRecord[]>(`/api/files/${entityType}/${entityId}`, z.array(fileSchema)),

  delete: (id: number) => api.delete<void>(`/api/files/${id}`),

  getSignedUrl: (id: number) =>
    api.get<{ signedUrl: string; expiresIn: number; fileName: string; mimeType?: string | null; size?: number | null }>(
      `/api/files/${id}/signed-url`,
      signedUrlSchema
    ),

  transcribeFile: (id: number) =>
    api.post<TranscriptionResult>(`/api/files/${id}/transcribe`, {}, transcriptionResultSchema),

  transcribeAudio: (audioUrl: string, language?: string) =>
    api.post<TranscriptionResult>("/api/audio/transcribe", { audioUrl, language }, transcriptionResultSchema),
};
