import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";
import { FilterPanel, type InboxFilters } from "@/components/filter-panel";
import { FileList } from "@/components/file-uploader";
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
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [filters, setFilters] = useState<InboxFilters>({});
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<ConversationWithRelations[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
  });

  const { data: emailTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

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
    toast({ title: `Template "${template.name}" applied` });
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
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return d.toLocaleDateString("pt-BR", { weekday: "short" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex h-full">
      <div className="flex w-80 flex-col border-r">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold" data-testid="text-inbox-title">Inbox</h2>
            <FilterPanel
              type="inbox"
              filters={filters}
              onFiltersChange={(f) => setFilters(f as InboxFilters)}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-inbox-search"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations && filteredConversations.length > 0 ? (
            <div className="space-y-1 p-2">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover-elevate ${
                    selectedConversation?.id === conversation.id
                      ? "bg-accent"
                      : ""
                  }`}
                  data-testid={`conversation-${conversation.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {conversation.contact
                        ? `${conversation.contact.firstName?.[0] || ""}${conversation.contact.lastName?.[0] || ""}`
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {conversation.contact
                          ? `${conversation.contact.firstName} ${conversation.contact.lastName}`
                          : "Unknown"}
                      </span>
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {formatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {conversation.subject || "No subject"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {getChannelIcon(conversation.channel)}
                      {(conversation.unreadCount || 0) > 0 && (
                        <Badge className="h-5 px-1.5 text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              No conversations yet
            </div>
          )}
        </ScrollArea>
      </div>

      {selectedConversation ? (
        <>
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedConversation.contact
                      ? `${selectedConversation.contact.firstName?.[0] || ""}${selectedConversation.contact.lastName?.[0] || ""}`
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    {selectedConversation.contact
                      ? `${selectedConversation.contact.firstName} ${selectedConversation.contact.lastName}`
                      : "Unknown"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.subject || "No subject"}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{selectedConversation.channel}</Badge>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
                      <Skeleton className="h-20 w-64 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderType === "user" ? "justify-end" : ""}`}
                      data-testid={`message-${message.id}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.isInternal
                            ? "border-2 border-dashed border-yellow-500/50 bg-yellow-500/10"
                            : message.senderType === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent"
                        }`}
                      >
                        {message.isInternal && (
                          <div className="mb-1 flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                            <AtSign className="h-3 w-3" />
                            Internal note
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <FileList entityType="message" entityId={message.id} inline />
                        <div className="mt-1 flex items-center justify-end gap-1 text-xs opacity-70">
                          <Clock className="h-3 w-3" />
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No messages yet. Start the conversation!
                </div>
              )}
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="border-t p-4">
              <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isInternalComment ? "outline" : "default"}
                    size="sm"
                    onClick={() => setIsInternalComment(false)}
                    data-testid="button-reply-mode"
                  >
                    Reply
                  </Button>
                  <Button
                    type="button"
                    variant={isInternalComment ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsInternalComment(true)}
                    data-testid="button-internal-mode"
                  >
                    <AtSign className="mr-1 h-3 w-3" />
                    Internal Note
                  </Button>
                </div>
                {emailTemplates && emailTemplates.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-template-picker">
                        <FileText className="mr-1 h-3 w-3" />
                        Templates
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
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                        pf.status === "error" ? "border-destructive text-destructive" : ""
                      }`}
                      data-testid={`pending-file-${pf.id}`}
                    >
                      {getFileIcon(pf.file.type)}
                      <span className="max-w-[120px] truncate">{pf.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(pf.id)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                        data-testid={`button-remove-pending-${pf.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="button-attach-file"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  id="message-input"
                  placeholder={
                    isInternalComment
                      ? "Add an internal note (press 'c' to focus)..."
                      : "Type your message (press 'r' to focus)..."
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className={`min-h-[80px] resize-none ${
                    isInternalComment ? "border-yellow-500/50" : ""
                  }`}
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={(!newMessage.trim() && pendingFiles.length === 0) || sendMessageMutation.isPending || uploading}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>

          <div className="w-72 border-l p-4">
            <h4 className="mb-4 font-semibold">Context</h4>

            {selectedConversation.contact && (
              <div className="mb-4 rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Contact
                </div>
                <p className="font-medium">
                  {selectedConversation.contact.firstName}{" "}
                  {selectedConversation.contact.lastName}
                </p>
                {selectedConversation.contact.email && (
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.contact.email}
                  </p>
                )}
                {selectedConversation.contact.phone && (
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.contact.phone}
                  </p>
                )}
              </div>
            )}

            {selectedConversation.deal && (
              <div className="mb-4 rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  Related Deal
                </div>
                <p className="font-medium">{selectedConversation.deal.title}</p>
                {selectedConversation.deal.value && (
                  <p className="text-sm text-muted-foreground">
                    R$ {Number(selectedConversation.deal.value).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Conversation Info
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Channel:</span>{" "}
                  {selectedConversation.channel}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant="secondary">{selectedConversation.status}</Badge>
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Select a conversation to view messages</p>
            <p className="mt-1 text-sm">
              Use <kbd className="rounded bg-muted px-1">j</kbd>/<kbd className="rounded bg-muted px-1">k</kbd> to navigate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
