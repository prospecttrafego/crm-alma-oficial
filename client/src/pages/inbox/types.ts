import type { MessagesResponse } from "@/lib/api/conversations";

export interface PendingFile {
  id: string;
  file: globalThis.File;
  uploadURL?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
}

export type InboxMessage = MessagesResponse["messages"][number];

export type TypingUser = {
  userId: string;
  userName?: string | null;
};

