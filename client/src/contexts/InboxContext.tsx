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
  useEffect,
  type ReactNode,
  type RefObject,
} from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { filesApi } from "@/lib/api/files";
import { conversationsApi, type ConversationWithRelations } from "@/lib/api/conversations";
import { queryClient } from "@/lib/queryClient";
import type { PendingFile } from "@/pages/inbox/types";
import type { InboxFilters } from "@/components/filter-panel";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface InboxContextValue {
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

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const InboxContext = createContext<InboxContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

interface InboxProviderProps {
  children: ReactNode;
}

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

  // File uploads
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup audio recording resources on unmount
  useEffect(() => {
    return () => {
      // Stop media recorder if still active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      // Stop all media stream tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Clear recording interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Panel collapse
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);

  // Virtuoso scroll ref for message list
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(10000);

  // ---------------------------------------------------------------------------
  // File upload handlers
  // ---------------------------------------------------------------------------

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        toast({ title: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
    setUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [toast]);

  const removePendingFile = useCallback((fileId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // ---------------------------------------------------------------------------
  // Audio recording handlers
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream; // Store stream reference for cleanup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        // Stop stream tracks and clear ref
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (_error) {
      // Clean up stream on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      toast({ title: t("toast.error"), description: t("errors.generic"), variant: "destructive" });
    }
  }, [t, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [isRecording]);

  const sendAudioMessage = useCallback(async () => {
    if (!audioBlob || !selectedConversation) return;

    try {
      // Upload audio file
      const { uploadURL } = await filesApi.getUploadUrl();

      await fetch(uploadURL, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": "audio/webm" },
      });

      // Create message with audio
      const messageData = await conversationsApi.sendMessage(selectedConversation.id, {
        content: "Mensagem de audio",
        isInternal: isInternalComment,
      });

      // Attach audio file to message
      await filesApi.register({
        name: `audio_${Date.now()}.webm`,
        mimeType: "audio/webm",
        size: audioBlob.size,
        uploadURL,
        entityType: "message",
        entityId: messageData.id,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      setAudioBlob(null);
      setRecordingTime(0);
      playMessageSent();
      toast({ title: t("toast.saved") });
    } catch (_error) {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  }, [audioBlob, selectedConversation, isInternalComment, t, toast, playMessageSent]);

  // ---------------------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------------------

  const clearMessageState = useCallback(() => {
    setNewMessage("");
    setPendingFiles([]);
  }, []);

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

    // File uploads
    pendingFiles,
    setPendingFiles,
    uploading,
    handleFileSelect,
    removePendingFile,
    fileInputRef,

    // Audio recording
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    sendAudioMessage,

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

export function useInboxComposition() {
  const { newMessage, setNewMessage, isInternalComment, setIsInternalComment, clearMessageState } = useInbox();
  return { newMessage, setNewMessage, isInternalComment, setIsInternalComment, clearMessageState };
}

export function useInboxFiles() {
  const { pendingFiles, setPendingFiles, uploading, handleFileSelect, removePendingFile, fileInputRef } = useInbox();
  return { pendingFiles, setPendingFiles, uploading, handleFileSelect, removePendingFile, fileInputRef };
}

export function useInboxAudio() {
  const { isRecording, recordingTime, audioBlob, startRecording, stopRecording, cancelRecording, sendAudioMessage } = useInbox();
  return { isRecording, recordingTime, audioBlob, startRecording, stopRecording, cancelRecording, sendAudioMessage };
}

export function useInboxPanels() {
  const { listPanelCollapsed, setListPanelCollapsed, contextPanelCollapsed, setContextPanelCollapsed } = useInbox();
  return { listPanelCollapsed, setListPanelCollapsed, contextPanelCollapsed, setContextPanelCollapsed };
}
