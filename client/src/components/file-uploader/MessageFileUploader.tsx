import { useRef, useState } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filesApi } from "@/lib/api/files";
import { getFileIcon } from "./utils";
import type { PendingFile } from "./types";

interface MessageFileUploaderProps {
  onFilesChange: (files: PendingFile[]) => void;
  pendingFiles: PendingFile[];
}

export function MessageFileUploader({ onFilesChange, pendingFiles }: MessageFileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      }
    }

    onFilesChange([...pendingFiles, ...newPendingFiles]);
    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (fileId: string) => {
    onFilesChange(pendingFiles.filter((f) => f.id !== fileId));
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-message-file-upload"
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="button-message-attach"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
      </div>

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((pf) => (
            <div
              key={pf.id}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                pf.status === "error" ? "border-destructive text-destructive" : ""
              }`}
              data-testid={`pending-file-${pf.id}`}
            >
              {getFileIcon(pf.file.type, "sm")}
              <span className="max-w-[120px] truncate">{pf.file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(pf.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                data-testid={`button-remove-pending-${pf.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
