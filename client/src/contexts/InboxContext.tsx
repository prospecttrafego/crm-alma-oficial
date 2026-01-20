/**
 * Inbox Context
 * Centralized state management for the inbox feature
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { InboxFilters } from "@/components/filter-panel";
import type { InboxMessage } from "@/pages/inbox/types";
import type { ConversationWithRelations } from "@/lib/api/conversations";
import { useInboxFileUploads } from "@/contexts/inbox/hooks/useInboxFileUploads";
import { useInboxAudioRecorder } from "@/contexts/inbox/hooks/useInboxAudioRecorder";
import type { InboxContextValue, InboxProviderProps } from "@/contexts/inbox/types";

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const InboxContext = createContext<InboxContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function InboxProvider({ children }: InboxProviderProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { playMessageSent, playMessageReceived } = useNotificationSound();

  // Conversation selection
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithRelations | null>(null);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<InboxFilters>({});

  // Message composition
  const [newMessage, setNewMessage] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  // Reply/quote feature
  const [replyingTo, setReplyingTo] = useState<InboxMessage | null>(null);

  // File uploads
  const fileUpload = useInboxFileUploads({
    onError: (message) =>
      toast({
        title: message,
        variant: "destructive",
      }),
  });

  // Audio recording
  const audioRecorder = useInboxAudioRecorder({
    selectedConversation,
    isInternalComment,
    onError: (message) =>
      toast({
        title: t("toast.error"),
        description: message,
        variant: "destructive",
      }),
    onSuccess: (message) =>
      toast({
        title: message,
      }),
    onSentSound: playMessageSent,
  });

  // Panel collapse
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);

  // Virtuoso scroll ref for message list
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(10000);

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const clearMessageState = useCallback(() => {
    setNewMessage("");
    fileUpload.setPendingFiles([]);
    setReplyingTo(null);
  }, [fileUpload]);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: InboxContextValue = {
    // Conversation selection
    selectedConversation,
    setSelectedConversation,

    // Search and filters
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,

    // Message composition
    newMessage,
    setNewMessage,
    isInternalComment,
    setIsInternalComment,
    // Reply/quote
    replyingTo,
    setReplyingTo,
    cancelReply,

    // File uploads
    pendingFiles: fileUpload.pendingFiles,
    setPendingFiles: fileUpload.setPendingFiles,
    uploading: fileUpload.uploading,
    handleFileSelect: fileUpload.handleFileSelect,
    removePendingFile: fileUpload.removePendingFile,
    fileInputRef: fileUpload.fileInputRef,

    // Audio recording
    isRecording: audioRecorder.isRecording,
    recordingTime: audioRecorder.recordingTime,
    audioBlob: audioRecorder.audioBlob,
    startRecording: audioRecorder.startRecording,
    stopRecording: audioRecorder.stopRecording,
    cancelRecording: audioRecorder.cancelRecording,
    sendAudioMessage: audioRecorder.sendAudioMessage,

    // Panel collapse
    listPanelCollapsed,
    setListPanelCollapsed,
    contextPanelCollapsed,
    setContextPanelCollapsed,

    // Virtuoso scroll
    virtuosoRef,
    firstItemIndex,
    setFirstItemIndex,

    // Sound effects
    playMessageSent,
    playMessageReceived,

    // Utilities
    clearMessageState,
  };

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error("useInbox must be used within an InboxProvider");
  }
  return context;
}

// Export individual state selectors for memoization optimization
export function useInboxConversation() {
  const { selectedConversation, setSelectedConversation } = useInbox();
  return { selectedConversation, setSelectedConversation };
}

export function useInboxFilters() {
  const { searchQuery, setSearchQuery, filters, setFilters } = useInbox();
  return { searchQuery, setSearchQuery, filters, setFilters };
}
