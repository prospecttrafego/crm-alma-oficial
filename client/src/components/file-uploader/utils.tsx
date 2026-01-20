import type { ReactNode } from "react";
import { File as FileIcon, Image, FileText, Music } from "lucide-react";

export function getFileIcon(mimeType: string | null, size: "sm" | "md" = "md"): ReactNode {
  const iconClass = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  if (!mimeType) return <FileIcon className={iconClass} />;
  if (mimeType.startsWith("image/")) return <Image className={iconClass} />;
  if (mimeType.startsWith("audio/")) return <Music className={iconClass} />;
  if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className={iconClass} />;
  return <FileIcon className={iconClass} />;
}

export function isAudioFile(mimeType: string | null): boolean {
  return mimeType?.startsWith("audio/") || false;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
