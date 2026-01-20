import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { File as FileRecord, FileEntityType } from "@shared/schema";
import { filesApi } from "@/lib/api/files";
import { AudioWaveform } from "@/components/audio-waveform";
import { getFileIcon, isAudioFile } from "./utils";
import { useFileDownload } from "./useFileDownload";

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
  const { downloadFile, downloadingId } = useFileDownload();

  if (!files || files.length === 0) return null;

  // Separate audio files from other files
  const audioFiles = files.filter((file) => isAudioFile(file.mimeType));
  const otherFiles = files.filter((file) => !isAudioFile(file.mimeType));

  const audioQueries = useQueries({
    queries: audioFiles.map((file) => ({
      queryKey: ["/api/files", file.id, "signed-url"],
      queryFn: () => filesApi.getSignedUrl(file.id),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const audioUrlMap = useMemo(() => {
    const map = new Map<number, string>();
    audioFiles.forEach((file, index) => {
      const data = audioQueries[index]?.data;
      if (data?.signedUrl) {
        map.set(file.id, data.signedUrl);
      }
    });
    return map;
  }, [audioFiles, audioQueries]);

  const renderAudio = (file: FileRecord) => {
    const signedUrl = audioUrlMap.get(file.id);
    if (!signedUrl) {
      return (
        <div className="flex items-center gap-2 rounded border px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading audio...</span>
        </div>
      );
    }

    return (
      <AudioWaveform
        src={signedUrl}
        fileId={file.id}
        compact={inline}
        showDownload
        showTranscribe
        height={inline ? 36 : 48}
      />
    );
  };

  if (inline) {
    return (
      <div className="mt-2 space-y-2">
        {audioFiles.map((file) => (
          <div key={file.id} data-testid={`audio-file-${file.id}`}>
            {renderAudio(file)}
          </div>
        ))}
        {otherFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {otherFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => downloadFile(file)}
                className="inline-flex items-center gap-1 rounded bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
                data-testid={`file-link-${file.id}`}
                disabled={downloadingId === file.id}
              >
                {downloadingId === file.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  getFileIcon(file.mimeType, "sm")
                )}
                <span className="max-w-[150px] truncate">{file.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {audioFiles.map((file) => (
        <div key={file.id} data-testid={`audio-file-${file.id}`}>
          {renderAudio(file)}
        </div>
      ))}
      {otherFiles.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => downloadFile(file)}
          className="flex items-center gap-2 rounded p-1 text-sm hover:bg-muted"
          data-testid={`file-link-${file.id}`}
          disabled={downloadingId === file.id}
        >
          {downloadingId === file.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            getFileIcon(file.mimeType, "md")
          )}
          <span className="truncate">{file.name}</span>
        </button>
      ))}
    </div>
  );
}
