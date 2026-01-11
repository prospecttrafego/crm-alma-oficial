/**
 * Files API - upload and file management
 */

import { api } from "./index";
import type { File as FileRecord } from "@shared/schema";

export type RegisterFilePayload = {
  name: string;
  mimeType?: string | null;
  size?: number | null;
  uploadURL?: string;
  objectPath?: string;
  entityType: string;
  entityId: number | string;
};

export type TranscriptionResult = {
  text?: string;
  message?: string;
  jobId?: string;
  status?: string;
  fileId?: number;
  fileName?: string;
};

export const filesApi = {
  getUploadUrl: () =>
    api.post<{ uploadURL: string; objectPath: string }>("/api/files/upload-url", {}),

  register: (data: RegisterFilePayload) =>
    api.post<FileRecord>("/api/files", data),

  listByEntity: (entityType: string, entityId: number) =>
    api.get<FileRecord[]>(`/api/files/${entityType}/${entityId}`),

  delete: (id: number) => api.delete<void>(`/api/files/${id}`),

  transcribeFile: (id: number) =>
    api.post<TranscriptionResult>(`/api/files/${id}/transcribe`, {}),

  transcribeAudio: (audioUrl: string, language?: string) =>
    api.post<TranscriptionResult>("/api/audio/transcribe", { audioUrl, language }),
};
