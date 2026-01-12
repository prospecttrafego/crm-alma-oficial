import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/lib/api/files";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X, File as FileIcon, Image, FileText, Download, Trash2, Loader2, Music } from "lucide-react";
import { AudioWaveform } from "@/components/audio-waveform";
import type { File as FileRecord, FileEntityType } from "@shared/schema";

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
  const [uploading, setUploading] = useState(false);

  const { data: files, isLoading: filesLoading } = useQuery<FileRecord[]>({
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

    setUploading(true);

    try {
      for (const file of Array.from(selectedFiles)) {
        const { uploadURL } = await filesApi.getUploadUrl();

        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        const registeredFile = await filesApi.register({
          name: file.name,
          mimeType: file.type,
          size: file.size,
          uploadURL,
          entityType,
          entityId,
        });
        
        if (onUploadComplete) {
          onUploadComplete(registeredFile);
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/files", entityType, entityId] });
        toast({ title: `${file.name} uploaded successfully` });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Failed to upload file", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileIcon className="h-4 w-4" />;
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                <a
                  href={file.objectPath}
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-testid={`button-download-file-${file.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
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

interface FileListProps {
  entityType: FileEntityType;
  entityId: number;
  inline?: boolean;
}

export function FileList({ entityType, entityId, inline = false }: FileListProps) {
  const { data: files } = useQuery<FileRecord[]>({
    queryKey: ["/api/files", entityType, entityId],
    queryFn: () => filesApi.listByEntity(entityType, entityId),
    enabled: entityId > 0,
  });

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileIcon className="h-3 w-3" />;
    if (mimeType.startsWith("image/")) return <Image className="h-3 w-3" />;
    if (mimeType.startsWith("audio/")) return <Music className="h-3 w-3" />;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="h-3 w-3" />;
    return <FileIcon className="h-3 w-3" />;
  };

  const isAudioFile = (mimeType: string | null) => {
    return mimeType?.startsWith("audio/") || false;
  };

  if (!files || files.length === 0) return null;

  // Separate audio files from other files
  const audioFiles = files.filter((file) => isAudioFile(file.mimeType));
  const otherFiles = files.filter((file) => !isAudioFile(file.mimeType));

  if (inline) {
    return (
      <div className="mt-2 space-y-2">
        {/* Audio files with waveform */}
        {audioFiles.map((file) => (
          <div key={file.id} data-testid={`audio-file-${file.id}`}>
            <AudioWaveform
              src={file.objectPath}
              fileId={file.id}
              compact
              showDownload
              showTranscribe
              height={36}
            />
          </div>
        ))}
        {/* Other files as links */}
        {otherFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {otherFiles.map((file) => (
              <a
                key={file.id}
                href={file.objectPath}
                download={file.name}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
                data-testid={`file-link-${file.id}`}
              >
                {getFileIcon(file.mimeType)}
                <span className="max-w-[150px] truncate">{file.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Audio files with waveform */}
      {audioFiles.map((file) => (
        <div key={file.id} data-testid={`audio-file-${file.id}`}>
          <AudioWaveform
            src={file.objectPath}
            fileId={file.id}
            showDownload
            showTranscribe
            height={48}
          />
        </div>
      ))}
      {/* Other files as links */}
      {otherFiles.map((file) => (
        <a
          key={file.id}
          href={file.objectPath}
          download={file.name}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded p-1 text-sm hover:bg-muted"
          data-testid={`file-link-${file.id}`}
        >
          {getFileIcon(file.mimeType)}
          <span className="truncate">{file.name}</span>
        </a>
      ))}
    </div>
  );
}

interface PendingFile {
  id: string;
  file: globalThis.File;
  uploadURL?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
}

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
        const { uploadURL } = await filesApi.getUploadUrl();

        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        newPendingFiles.push({
          id: crypto.randomUUID(),
          file,
          uploadURL,
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="h-3 w-3" />;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="h-3 w-3" />;
    return <FileIcon className="h-3 w-3" />;
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
              {getFileIcon(pf.file.type)}
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
