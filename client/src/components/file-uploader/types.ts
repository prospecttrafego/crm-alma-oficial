export interface PendingFile {
  id: string;
  file: globalThis.File;
  objectPath?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
}
