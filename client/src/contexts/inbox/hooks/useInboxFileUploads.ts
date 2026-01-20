import { useCallback, useRef, useState } from "react";
import { filesApi } from "@/lib/api/files";
import type { PendingFile } from "@/pages/inbox/types";

interface UseInboxFileUploadsOptions {
  onError: (message: string) => void;
}

export function useInboxFileUploads({ onError }: UseInboxFileUploadsOptions) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const newPendingFiles: PendingFile[] = [];

    for (const file of Array.from(selectedFiles)) {
      try {
        const { uploadURL, objectPath } = await filesApi.getUploadUrl({ size: file.size });

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

        newPendingFiles.push({
          id: crypto.randomUUID(),
          file,
          objectPath,
          status: "uploaded",
        });
      } catch (error) {
        console.error("Upload error:", error);
        newPendingFiles.push({
          id: crypto.randomUUID(),
          file,
          status: "error",
        });
        onError(`Failed to upload ${file.name}`);
      }
    }

    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onError]);

  const removePendingFile = useCallback((fileId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  return {
    pendingFiles,
    setPendingFiles,
    uploading,
    handleFileSelect,
    removePendingFile,
    fileInputRef,
  };
}
