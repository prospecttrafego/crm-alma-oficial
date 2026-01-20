import type { ReactNode, RefObject } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import type { ConversationWithRelations } from "@/lib/api/conversations";
import type { InboxFilters } from "@/components/filter-panel";
import type { PendingFile, InboxMessage } from "@/pages/inbox/types";

export interface InboxContextValue {
  // Conversation selection
  selectedConversation: ConversationWithRelations | null;
  setSelectedConversation: (conv: ConversationWithRelations | null) => void;

  // Search and filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: InboxFilters;
  setFilters: (filters: InboxFilters) => void;

  // Message composition
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  isInternalComment: boolean;
  setIsInternalComment: React.Dispatch<React.SetStateAction<boolean>>;
  // Reply/quote feature
  replyingTo: InboxMessage | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<InboxMessage | null>>;
  cancelReply: () => void;

  // File uploads
  pendingFiles: PendingFile[];
  setPendingFiles: React.Dispatch<React.SetStateAction<PendingFile[]>>;
  uploading: boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removePendingFile: (fileId: string) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;

  // Audio recording
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  sendAudioMessage: () => Promise<void>;

  // Panel collapse state
  listPanelCollapsed: boolean;
  setListPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  contextPanelCollapsed: boolean;
  setContextPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;

  // Virtuoso scroll ref
  virtuosoRef: RefObject<VirtuosoHandle | null>;
  firstItemIndex: number;
  setFirstItemIndex: React.Dispatch<React.SetStateAction<number>>;

  // Sound effects
  playMessageSent: () => void;
  playMessageReceived: () => void;

  // Clear message state after send
  clearMessageState: () => void;
}

export interface InboxProviderProps {
  children: ReactNode;
}
