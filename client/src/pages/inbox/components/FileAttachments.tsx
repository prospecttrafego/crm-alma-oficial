"use client";

import type { PendingFile } from "@/pages/inbox/types";
import { File as FileIcon, FileText, Image, X } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="h-3 w-3" aria-hidden="true" />;
  if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="h-3 w-3" aria-hidden="true" />;
  return <FileIcon className="h-3 w-3" aria-hidden="true" />;
}

type Props = {
  pendingFiles: PendingFile[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingFile: (fileId: string) => void;
};

export function FileAttachments({ pendingFiles, fileInputRef, onFileSelect, onRemovePendingFile }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={onFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />

      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((pf) => (
            <div
              key={pf.id}
              className={`inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground ${
                pf.status === "error" ? "border border-red-500 text-red-400" : ""
              }`}
              data-testid={`pending-file-${pf.id}`}
            >
              {getFileIcon(pf.file.type)}
              <span className="max-w-[120px] truncate">{pf.file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemovePendingFile(pf.id)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  data-testid={`button-remove-pending-${pf.id}`}
                  aria-label={t("a11y.removeItem")}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
