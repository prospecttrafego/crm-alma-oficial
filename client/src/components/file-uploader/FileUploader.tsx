import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/lib/api/files";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload } from "@/hooks/useFileUpload";
import { Paperclip, Download, Trash2, Loader2 } from "lucide-react";
import type { File as FileRecord, FileEntityType } from "@shared/schema";
import { formatFileSize, getFileIcon } from "./utils";
import { useFileDownload } from "./useFileDownload";

interface FileUploaderProps {
  entityType: FileEntityType;
  entityId: number;
  onUploadComplete?: (file: FileRecord) => void;
  showExistingFiles?: boolean;
  compact?: boolean;
}

export function FileUploader({
  entityType,
  entityId,
  onUploadComplete,
  showExistingFiles = true,
  compact = false,
}: FileUploaderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { downloadFile, downloadingId } = useFileDownload();
  const { uploadFile, uploading } = useFileUpload({
    onError: () => toast({ title: "Failed to upload file", variant: "destructive" }),
  });

  const { data: files } = useQuery<FileRecord[]>({
    queryKey: ["/api/files", entityType, entityId],
    queryFn: () => filesApi.listByEntity(entityType, entityId),
    enabled: showExistingFiles && entityId > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      await filesApi.delete(fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files", entityType, entityId] });
      toast({ title: "File deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    for (const file of Array.from(selectedFiles)) {
      const result = await uploadFile(file);

      if (result.success && result.objectPath) {
        try {
          const registeredFile = await filesApi.register({
            name: file.name,
            mimeType: file.type,
            size: file.size,
            objectPath: result.objectPath,
            entityType,
            entityId,
          });

          if (onUploadComplete) {
            onUploadComplete(registeredFile);
          }

          queryClient.invalidateQueries({ queryKey: ["/api/files", entityType, entityId] });
          toast({ title: `${file.name} uploaded successfully` });
        } catch (error) {
          console.error("Registration error:", error);
          toast({ title: "Failed to register file", variant: "destructive" });
        }
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-upload"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="button-attach-file"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        data-testid="button-attach-file"
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Paperclip className="mr-2 h-4 w-4" />
            Attach Files
          </>
        )}
      </Button>

      {showExistingFiles && files && files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
              data-testid={`file-item-${file.id}`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {getFileIcon(file.mimeType)}
                <span className="truncate text-sm">{file.name}</span>
                {file.size && (
                  <Badge variant="secondary" className="flex-shrink-0">
                    {formatFileSize(file.size)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => downloadFile(file)}
                  disabled={downloadingId === file.id}
                  data-testid={`button-download-file-${file.id}`}
                >
                  {downloadingId === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(file.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-file-${file.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
