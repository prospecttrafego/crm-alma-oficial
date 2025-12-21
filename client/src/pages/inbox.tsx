import { useState, useEffect, useRef, useCallback } from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Send,
  MessageSquare,
  Mail,
  Phone,
  User,
  Building2,
  Clock,
  AtSign,
  FileText,
  ChevronDown,
  Paperclip,
  Image,
  File as FileIcon,
  Loader2,
  X,
  Smile,
  Mic,
  Plus,
  Square,
  Trash2,
  ArrowLeft,
  Check,
  CheckCheck,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { FilterPanel, type InboxFilters } from "@/components/filter-panel";
import { FileList } from "@/components/file-uploader";
import { AudioWaveform, AudioRecordingPreview } from "@/components/audio-waveform";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { Conversation, Message, Contact, Deal, User as UserType, EmailTemplate, Company, File as FileRecord } from "@shared/schema";

interface ContactWithCompany extends Contact {
  company?: Company;
}

interface ConversationWithRelations extends Conversation {
  contact?: ContactWithCompany;
  deal?: Deal;
  company?: Company;
  messages?: Message[];
  assignedTo?: UserType;
}

function substituteVariables(
  template: string,
  context: {
    contact?: ContactWithCompany | null;
    deal?: Deal | null;
    company?: Company | null;
    user?: UserType | null;
  }
): string {
  const { contact, deal, company, user } = context;
  
  return template
    .replace(/\{\{contact\.firstName\}\}/g, contact?.firstName || "")
    .replace(/\{\{contact\.lastName\}\}/g, contact?.lastName || "")
    .replace(/\{\{contact\.email\}\}/g, contact?.email || "")
    .replace(/\{\{contact\.phone\}\}/g, contact?.phone || "")
    .replace(/\{\{contact\.jobTitle\}\}/g, contact?.jobTitle || "")
    .replace(/\{\{deal\.title\}\}/g, deal?.title || "")
    .replace(/\{\{deal\.value\}\}/g, deal?.value ? Number(deal.value).toLocaleString("pt-BR") : "")
    .replace(/\{\{company\.name\}\}/g, company?.name || "")
    .replace(/\{\{user\.firstName\}\}/g, user?.firstName || "")
    .replace(/\{\{user\.lastName\}\}/g, user?.lastName || "");
}

interface MessageWithSender extends Message {
  sender?: UserType;
}

interface PendingFile {
  id: string;
  file: globalThis.File;
  uploadURL?: string;
  status: "pending" | "uploading" | "uploaded" | "error";
}

export default function InboxPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [filters, setFilters] = useState<InboxFilters>({});
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);

  // Emoji Picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Context panel collapse (desktop only)
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notification sounds
  const { playMessageReceived, playMessageSent } = useNotificationSound();

  // WebSocket for real-time features with sound notifications
  const { sendTyping, getTypingUsers } = useWebSocket({
    onMessage: (message) => {
      // Play sound for new messages from others
      if (message.type === "message:created" && message.data) {
        const messageData = message.data as { senderId?: string; senderType?: string };
        // Only play sound if message is from contact or system (not from current user)
        if (messageData.senderType !== "user" || messageData.senderId !== user?.id) {
          playMessageReceived();
        }
      }
    },
  });

  // Get typing users for current conversation
  const currentTypingUsers = selectedConversation
    ? getTypingUsers(selectedConversation.id).filter((t) => t.userId !== user?.id)
    : [];

  // Handle typing indicator - debounced
  const handleTyping = useCallback(() => {
    if (!selectedConversation || !user) return;

    // Send typing indicator
    sendTyping(selectedConversation.id, user.id, `${user.firstName} ${user.lastName}`);

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [selectedConversation, user, sendTyping]);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<ConversationWithRelations[]>({
    queryKey: ["/api/conversations"],
  });

  // Ref for Virtuoso to control scroll
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(10000);

  // Infinite query for messages with cursor-based pagination
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{
    messages: MessageWithSender[];
    nextCursor: number | null;
    hasMore: boolean;
  }>({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", String(pageParam));
      params.set("limit", "30");
      const response = await apiRequest(
        "GET",
        `/api/conversations/${selectedConversation?.id}/messages?${params.toString()}`
      );
      return response.json();
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
  });

  // Flatten messages from all pages (pages are in reverse order, newest first)
  const messages = messagesData?.pages
    ? messagesData.pages.flatMap((page) => page.messages)
    : [];

  // Handle loading more messages when scrolling to top
  const loadMoreMessages = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      const currentLength = messages.length;
      fetchNextPage().then(() => {
        // Calculate how many new messages were added
        const newLength = messagesData?.pages
          ? messagesData.pages.flatMap((p) => p.messages).length
          : 0;
        const diff = newLength - currentLength;
        if (diff > 0) {
          setFirstItemIndex((prev) => prev - diff);
        }
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages.length, messagesData]);

  // Reset firstItemIndex when conversation changes
  useEffect(() => {
    setFirstItemIndex(10000);
  }, [selectedConversation?.id]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (!selectedConversation?.id) return;

    // Mark as read after a short delay (ensures user actually viewed)
    const timeout = setTimeout(async () => {
      try {
        await apiRequest("POST", `/api/conversations/${selectedConversation.id}/read`);
        // Refresh conversations to update unread count
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [selectedConversation?.id]);

  const { data: emailTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  // Emoji picker handlers
  const onEmojiClick = useCallback((emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Audio recording handlers
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({ title: t("toast.error"), description: t("errors.generic"), variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
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
    }
  }, [isRecording]);

  const sendAudioMessage = useCallback(async () => {
    if (!audioBlob || !selectedConversation) return;

    try {
      // Upload audio file
      const urlResponse = await apiRequest("POST", "/api/files/upload-url", {});
      const { uploadURL } = await urlResponse.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": "audio/webm" },
      });

      // Create message with audio
      const response = await apiRequest("POST", `/api/conversations/${selectedConversation.id}/messages`, {
        content: "🎤 Mensagem de áudio",
        isInternal: isInternalComment,
      });
      const messageData = await response.json();

      // Attach audio file to message
      await apiRequest("POST", "/api/files", {
        name: `audio_${Date.now()}.webm`,
        mimeType: "audio/webm",
        size: audioBlob.size,
        uploadURL,
        entityType: "message",
        entityId: String(messageData.id),
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      setAudioBlob(null);
      setRecordingTime(0);
      playMessageSent();
      toast({ title: t("toast.saved") });
    } catch (error) {
      toast({ title: t("toast.error"), variant: "destructive" });
    }
  }, [audioBlob, selectedConversation, isInternalComment, toast, playMessageSent]);

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const applyTemplate = (template: EmailTemplate) => {
    // Use top-level company from conversation (resolved from contact or deal)
    const company = selectedConversation?.company || selectedConversation?.contact?.company;
    const substitutedBody = substituteVariables(template.body, {
      contact: selectedConversation?.contact,
      deal: selectedConversation?.deal,
      company: company,
      user: user,
    });
    setNewMessage(substitutedBody);
    toast({ title: t("toast.updated") });
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; isInternal: boolean; attachments?: PendingFile[] }) => {
      if (!selectedConversation) return;
      const response = await apiRequest("POST", `/api/conversations/${selectedConversation.id}/messages`, {
        content: data.content,
        isInternal: data.isInternal,
      });
      const messageData = await response.json();
      
      if (data.attachments && data.attachments.length > 0) {
        for (const pf of data.attachments) {
          if (pf.uploadURL && pf.status === "uploaded") {
            await apiRequest("POST", "/api/files", {
              name: pf.file.name,
              mimeType: pf.file.type,
              size: pf.file.size,
              uploadURL: pf.uploadURL,
              entityType: "message",
              entityId: String(messageData.id),
            });
          }
        }
      }
      return messageData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewMessage("");
      setPendingFiles([]);
      // Play sent sound
      playMessageSent();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "destructive" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const newPendingFiles: PendingFile[] = [];

    for (const file of Array.from(selectedFiles)) {
      try {
        const urlResponse = await apiRequest("POST", "/api/files/upload-url", {});
        const { uploadURL } = await urlResponse.json();

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
  };

  const removePendingFile = (fileId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="h-3 w-3" />;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="h-3 w-3" />;
    return <FileIcon className="h-3 w-3" />;
  };

  const filteredConversations = conversations?.filter((conv) => {
    if (filters.channel && conv.channel !== filters.channel) return false;
    if (filters.status && conv.status !== filters.status) return false;
    if (filters.assignedToId && conv.assignedToId !== filters.assignedToId) return false;
    
    if (!searchQuery) return true;
    const contactName = conv.contact
      ? `${conv.contact.firstName} ${conv.contact.lastName}`.toLowerCase()
      : "";
    return (
      contactName.includes(searchQuery.toLowerCase()) ||
      conv.subject?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";
      
      if (e.key === "j" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversations || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversation 
          ? list.findIndex((c) => c.id === selectedConversation.id)
          : -1;
        const nextIndex = currentIndex < list.length - 1 ? currentIndex + 1 : currentIndex;
        if (list[nextIndex]) {
          setSelectedConversation(list[nextIndex]);
        }
      }
      
      if (e.key === "k" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversations || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversation 
          ? list.findIndex((c) => c.id === selectedConversation.id)
          : list.length;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (list[prevIndex]) {
          setSelectedConversation(list[prevIndex]);
        }
      }
      
      if (!selectedConversation) return;
      if (e.key === "r" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        setIsInternalComment(false);
        document.getElementById("message-input")?.focus();
      }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        setIsInternalComment(true);
        document.getElementById("message-input")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedConversation, filteredConversations]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && pendingFiles.length === 0) return;
    sendMessageMutation.mutate({
      content: newMessage || (pendingFiles.length > 0 ? "[Attachment]" : ""),
      isInternal: isInternalComment,
      attachments: pendingFiles.filter((f) => f.status === "uploaded"),
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      case "phone":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTranslatedValue = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const getChannelLabel = (channel: string) => {
    return getTranslatedValue(`inbox.channels.${channel}`, channel);
  };

  const getStatusLabel = (status: string) => {
    return getTranslatedValue(`inbox.status.${status}`, status);
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return t("common.yesterday");
    } else if (days < 7) {
      return d.toLocaleDateString("pt-BR", { weekday: "short" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex h-full">
      {/* Lista de conversas - esconde no mobile quando conversa selecionada */}
      <div className={`flex flex-col border-r border-border bg-background w-full md:w-[350px] ${selectedConversation ? "hidden md:flex" : "flex"}`}>
        {/* Header da lista */}
        <div className="bg-muted/50 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-medium text-foreground" data-testid="text-inbox-title">{t("inbox.title")}</h2>
            <FilterPanel
              type="inbox"
              filters={filters}
              onFiltersChange={(f) => setFilters(f as InboxFilters)}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("common.search")}
              className="h-9 w-full rounded-lg border border-border bg-muted pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              style={{ boxShadow: 'none' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-inbox-search"
            />
          </div>
        </div>

        <div className="flex-1 bg-background overflow-hidden">
          {conversationsLoading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 border-b border-border px-3 py-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations && filteredConversations.length > 0 ? (
            <Virtuoso
              style={{ height: "100%" }}
              data={filteredConversations}
              itemContent={(index, conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedConversation?.id === conversation.id
                      ? "bg-muted"
                      : ""
                  }`}
                  data-testid={`conversation-${conversation.id}`}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                      {conversation.contact
                        ? `${conversation.contact.firstName?.[0] || ""}${conversation.contact.lastName?.[0] || ""}`
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-normal text-foreground">
                        {conversation.contact
                          ? `${conversation.contact.firstName} ${conversation.contact.lastName}`
                          : "Desconhecido"}
                      </span>
                      <span className={`flex-shrink-0 text-xs ${(conversation.unreadCount || 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {formatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="truncate text-[13px] text-muted-foreground">
                        {conversation.subject || "Sem assunto"}
                      </p>
                      {(conversation.unreadCount || 0) > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              {t("inbox.noConversations")}
            </div>
          )}
        </div>
      </div>

      {selectedConversation ? (
        <>
          {/* Area de chat - full width no mobile */}
          <div className="flex flex-1 flex-col bg-background">
            {/* Header do chat */}
            <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-3">
                {/* Botão voltar - apenas mobile */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden h-10 w-10 text-muted-foreground hover:text-foreground"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {selectedConversation.contact
                      ? `${selectedConversation.contact.firstName?.[0] || ""}${selectedConversation.contact.lastName?.[0] || ""}`
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-[15px] font-medium text-foreground">
                    {selectedConversation.contact
                      ? `${selectedConversation.contact.firstName} ${selectedConversation.contact.lastName}`
                      : "Desconhecido"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.subject || "Clique para ver informações do contato"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <Search className="h-5 w-5 cursor-pointer hover:text-foreground" />
              </div>
            </div>

            <div className="flex-1 px-[5%] py-4 bg-muted/30 overflow-hidden">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
                      <Skeleton className="h-16 w-64 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : messages && messages.length > 0 ? (
                <Virtuoso
                  ref={virtuosoRef}
                  style={{ height: "100%" }}
                  data={messages}
                  firstItemIndex={firstItemIndex}
                  initialTopMostItemIndex={messages.length - 1}
                  followOutput="smooth"
                  startReached={loadMoreMessages}
                  components={{
                    Header: () =>
                      isFetchingNextPage ? (
                        <div className="flex justify-center py-2">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : hasNextPage ? (
                        <div className="flex justify-center py-2">
                          <span className="text-xs text-muted-foreground">
                            Role para carregar mais mensagens
                          </span>
                        </div>
                      ) : null,
                  }}
                  itemContent={(index, message) => (
                    <div
                      key={message.id}
                      className={`flex mb-1 ${message.senderType === "user" ? "justify-end" : ""}`}
                      data-testid={`message-${message.id}`}
                    >
                      <div
                        className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm ${
                          message.isInternal
                            ? "border border-dashed border-yellow-500/50 bg-yellow-900/30"
                            : message.senderType === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {message.isInternal && (
                          <div className="mb-1 flex items-center gap-1 text-xs text-yellow-400">
                            <AtSign className="h-3 w-3" />
                            Nota interna
                          </div>
                        )}
                        <p className="text-[14px] leading-[19px] whitespace-pre-wrap">{message.content}</p>
                        <FileList entityType="message" entityId={message.id} inline />
                        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                          {formatTime(message.createdAt)}
                          {/* Read receipt indicator for sent messages */}
                          {message.senderType === "user" && (
                            message.readBy && message.readBy.length > 0 ? (
                              <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  {t("inbox.noMessages")}
                </div>
              )}
            </div>

            {/* Typing indicator */}
            {currentTypingUsers.length > 0 && (
              <div className="px-4 py-1 bg-muted/30 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>
                    {currentTypingUsers.length === 1
                      ? `${currentTypingUsers[0].userName || "Alguém"} está digitando...`
                      : `${currentTypingUsers.length} pessoas estão digitando...`}
                  </span>
                </div>
              </div>
            )}

            {/* Area de input */}
            <form onSubmit={handleSendMessage} className="bg-muted/50 px-4 py-3 border-t border-border">
              {/* Recording UI */}
              {isRecording && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex items-center gap-2 flex-1 bg-muted rounded-lg px-4 py-3">
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-foreground font-mono text-lg">{formatRecordingTime(recordingTime)}</span>
                    <div className="flex-1 flex items-center gap-1">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-primary rounded-full animate-pulse"
                          style={{
                            height: `${Math.random() * 20 + 8}px`,
                            animationDelay: `${i * 0.05}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    onClick={cancelRecording}
                    className="h-10 w-10 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    data-testid="button-cancel-recording"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    onClick={stopRecording}
                    className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-stop-recording"
                  >
                    <Square className="h-5 w-5 fill-current" />
                  </Button>
                </div>
              )}

              {/* Audio Preview UI with Waveform */}
              {!isRecording && audioBlob && (
                <div className="py-2">
                  <AudioRecordingPreview
                    audioBlob={audioBlob}
                    onSend={sendAudioMessage}
                    onDiscard={cancelRecording}
                    isSending={sendMessageMutation.isPending}
                  />
                </div>
              )}

              {/* Normal Input UI */}
              {!isRecording && !audioBlob && (
                <>
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsInternalComment(false)}
                    className={`h-7 px-2 text-xs ${!isInternalComment ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    data-testid="button-reply-mode"
                  >
                    Responder
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsInternalComment(true)}
                    className={`h-7 px-2 text-xs ${isInternalComment ? "bg-yellow-600 text-white hover:bg-yellow-600/90" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    data-testid="button-internal-mode"
                  >
                    <AtSign className="mr-1 h-3 w-3" />
                    Nota
                  </Button>
                </div>
                {emailTemplates && emailTemplates.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted" data-testid="button-template-picker">
                        <FileText className="mr-1 h-3 w-3" />
                        {t("inbox.templates")}
                        <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {emailTemplates.map((template) => (
                        <DropdownMenuItem
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          data-testid={`menu-template-${template.id}`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{template.name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {template.subject}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
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
                        onClick={() => removePendingFile(pf.id)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                        data-testid={`button-remove-pending-${pf.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                {/* Botão + para anexos */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  data-testid="button-attach-file"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Plus className="h-6 w-6" />
                  )}
                </Button>

                {/* Campo de input com emoji */}
                <div className={`relative flex flex-1 items-center rounded-[8px] bg-muted pl-2 pr-3 py-[9px] ${isInternalComment ? "ring-1 ring-yellow-500/50" : ""}`}>
                  {/* Emoji Picker Popup */}
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-14 left-0 z-50">
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme={Theme.DARK}
                        width={320}
                        height={400}
                        searchPlaceHolder="Pesquisar emoji..."
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-transparent p-0"
                    data-testid="button-emoji"
                  >
                    <Smile className="h-[26px] w-[26px]" />
                  </Button>
                  <input
                    id="message-input"
                    type="text"
                    placeholder={
                      isInternalComment
                        ? t("common.notes")
                        : t("inbox.typeMessage")
                    }
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    className="flex-1 bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground text-[15px] ml-2 focus:outline-none focus:ring-0 focus:border-0"
                    style={{ boxShadow: 'none' }}
                    data-testid="input-message"
                  />
                </div>

                {/* Botão de enviar ou microfone */}
                {newMessage.trim() || pendingFiles.length > 0 ? (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={sendMessageMutation.isPending || uploading}
                    className="h-10 w-10 flex-shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-send-message"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    onClick={startRecording}
                    className="h-10 w-10 flex-shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-mic"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                )}
              </div>
              </>
              )}
            </form>
          </div>

          {/* Painel de contexto - esconde no mobile, colapsável no desktop */}
          <div className={`hidden lg:flex flex-col border-l border-border bg-background transition-all duration-200 ${contextPanelCollapsed ? 'w-12' : 'w-72'}`}>
            {/* Header com botão de toggle */}
            <div className={`flex items-center border-b border-border ${contextPanelCollapsed ? 'justify-center p-3' : 'justify-between p-4'}`}>
              {!contextPanelCollapsed && (
                <h4 className="text-sm font-medium text-foreground">Contexto</h4>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setContextPanelCollapsed(!contextPanelCollapsed)}
                title={contextPanelCollapsed ? "Expandir painel" : "Recolher painel"}
              >
                {contextPanelCollapsed ? (
                  <PanelRightOpen className="h-4 w-4" />
                ) : (
                  <PanelRightClose className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Conteúdo do painel - só mostra quando expandido */}
            {!contextPanelCollapsed && (
              <div className="flex-1 overflow-y-auto p-4">
                {selectedConversation.contact && (
                  <div className="mb-4 rounded-lg bg-muted p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-4 w-4" />
                      Contato
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedConversation.contact.firstName}{" "}
                      {selectedConversation.contact.lastName}
                    </p>
                    {selectedConversation.contact.email && (
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.contact.email}
                      </p>
                    )}
                    {selectedConversation.contact.phone && (
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.contact.phone}
                      </p>
                    )}
                  </div>
                )}

                {selectedConversation.deal && (
                  <div className="mb-4 rounded-lg bg-muted p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Negócio Relacionado
                    </div>
                    <p className="text-sm font-medium text-foreground">{selectedConversation.deal.title}</p>
                    {selectedConversation.deal.value && (
                      <p className="text-xs text-primary">
                        R$ {Number(selectedConversation.deal.value).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-muted p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    Info da Conversa
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      Canal: <span className="text-foreground">{getChannelLabel(selectedConversation.channel)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Status: <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">{getStatusLabel(selectedConversation.status || "open")}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Estado vazio - esconde no mobile (mostra só a lista) */
        <div className="hidden md:flex flex-1 items-center justify-center bg-background">
          <div className="text-center">
            <MessageSquare className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
            <p className="text-foreground text-lg">{t("inbox.noMessagesDescription")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">j</kbd>/<kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">k</kbd> para navegar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
