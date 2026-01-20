import { useCallback, useRef, useState } from "react";
import { useFileUpload } from "@/hooks/useFileUpload";
import type { PendingFile } from "@/pages/inbox/types";

interface UseInboxFileUploadsOptions {
  onError: (message: string) => void;
}

export function useInboxFileUploads({ onError }: UseInboxFileUploadsOptions) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFiles, uploading } = useFileUpload({
    onError: (msg, file) => onError(`Failed to upload ${file.name}`),
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const results = await uploadFiles(Array.from(selectedFiles));

    const newPendingFiles: PendingFile[] = results.map((result) => ({
      id: crypto.randomUUID(),
      file: result.file,
      objectPath: result.objectPath,
      status: result.success ? "uploaded" : "error",
    }));

    setPendingFiles((prev) => [...prev, ...newPendingFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [uploadFiles]);

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
