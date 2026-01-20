/**
 * Centralized file upload hook
 * Handles upload URL generation and file upload to storage
 */

import { useCallback, useState } from "react";
import { filesApi } from "@/lib/api/files";

export interface UploadResult {
  success: boolean;
  objectPath?: string;
  error?: string;
  file: File;
}

interface UseFileUploadOptions {
  onError?: (message: string, file: File) => void;
  onSuccess?: (objectPath: string, file: File) => void;
}

/**
 * Hook for uploading files to storage
 *
 * @example
 * const { uploadFile, uploadFiles, uploading } = useFileUpload({
 *   onError: (msg) => toast({ title: msg, variant: "destructive" }),
 * });
 *
 * // Single file
 * const result = await uploadFile(file);
 * if (result.success) {
 *   console.log("Uploaded to:", result.objectPath);
 * }
 *
 * // Multiple files
 * const results = await uploadFiles(fileList);
 */
export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const { onError, onSuccess } = options;

  /**
   * Upload a single file to storage
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      try {
        // 1. Get signed upload URL
        const { uploadURL, objectPath } = await filesApi.getUploadUrl({
          size: file.size,
        });

        // 2. Upload file to storage
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        onSuccess?.(objectPath, file);
        return { success: true, objectPath, file };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        onError?.(message, file);
        return { success: false, error: message, file };
      }
    },
    [onError, onSuccess]
  );

  /**
   * Upload multiple files to storage
   * Returns results for each file (success or error)
   */
  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      setUploading(true);
      const results: UploadResult[] = [];

      for (const file of files) {
        const result = await uploadFile(file);
        results.push(result);
      }

      setUploading(false);
      return results;
    },
    [uploadFile]
  );

  /**
   * Upload a single file with loading state
   */
  const uploadFileWithState = useCallback(
    async (file: File): Promise<UploadResult> => {
      setUploading(true);
      const result = await uploadFile(file);
      setUploading(false);
      return result;
    },
    [uploadFile]
  );

  return {
    uploadFile,
    uploadFiles,
    uploadFileWithState,
    uploading,
  };
}
