import { useCallback, useState } from "react";
import { filesApi } from "@/lib/api/files";
import type { File as FileRecord } from "@shared/schema";

export function useFileDownload() {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const downloadFile = useCallback(async (file: FileRecord) => {
    setDownloadingId(file.id);
    try {
      const { signedUrl } = await filesApi.getSignedUrl(file.id);
      const link = document.createElement("a");
      link.href = signedUrl;
      link.download = file.name;
      link.click();
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return { downloadFile, downloadingId };
}
