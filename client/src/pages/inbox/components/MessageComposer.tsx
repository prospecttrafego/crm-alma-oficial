"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { Theme as EmojiTheme, type EmojiClickData } from "emoji-picker-react";
import {
  AtSign,
  ChevronDown,
  File as FileIcon,
  FileText,
  Image,
  Loader2,
  Mic,
  Plus,
  Send,
  Smile,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AudioRecordingPreview } from "@/components/audio-waveform";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatRecordingTime } from "@/pages/inbox/utils";
import { ReplyPreview } from "./ReplyPreview";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { useMentionAutocomplete } from "@/hooks/useMentionAutocomplete";
import type { PendingFile, InboxMessage } from "@/pages/inbox/types";
import type { EmailTemplate } from "@shared/schema";

/**
 * Returns appropriate icon based on file MIME type.
 * Defined outside component to avoid recreation on each render.
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="h-3 w-3" />;
  if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="h-3 w-3" />;
  return <FileIcon className="h-3 w-3" />;
}

type Props = {
  onSubmit: (e: React.FormEvent) => void;
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  onCancelRecording: () => void;
  onStopRecording: () => void;
  onSendAudioMessage: () => void;
  isSending: boolean;
  isInternalComment: boolean;
  setIsInternalComment: (value: boolean) => void;
  emailTemplates: EmailTemplate[] | undefined;
  onApplyTemplate: (template: EmailTemplate) => void;
  pendingFiles: PendingFile[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingFile: (fileId: string) => void;
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  onTyping: () => void;
  onStartRecording: () => void;
  // Reply/quote feature
  replyingTo: InboxMessage | null;
  onCancelReply: () => void;
};

export function MessageComposer({
  onSubmit,
  isRecording,
  recordingTime,
  audioBlob,
  onCancelRecording,
  onStopRecording,
  onSendAudioMessage,
  isSending,
  isInternalComment,
  setIsInternalComment,
  emailTemplates,
  onApplyTemplate,
  pendingFiles,
  uploading,
  fileInputRef,
  onFileSelect,
  onRemovePendingFile,
  newMessage,
  setNewMessage,
  onTyping,
  onStartRecording,
  replyingTo,
  onCancelReply,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // @mentions autocomplete
  const {
    isActive: mentionActive,
    selectedIndex: mentionSelectedIndex,
    filteredUsers: mentionUsers,
    handleTextChange: handleMentionTextChange,
    handleKeyDown: handleMentionKeyDown,
    getSelectedUser,
    selectUser: selectMentionUser,
  } = useMentionAutocomplete();

  const resolvedEmojiTheme = useMemo(() => {
    if (theme === "dark") return EmojiTheme.DARK;
    if (theme === "light") return EmojiTheme.LIGHT;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? EmojiTheme.DARK : EmojiTheme.LIGHT;
  }, [theme]);

  const onEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      setNewMessage((prev) => prev + emojiData.emoji);
      setShowEmojiPicker(false);
    },
    [setNewMessage]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-muted/50 px-4 py-3">
      {isRecording && (
        <div className="flex items-center gap-3 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted px-4 py-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-lg text-foreground">{formatRecordingTime(recordingTime)}</span>
            <div className="flex flex-1 items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 animate-pulse rounded-full bg-primary"
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
            onClick={onCancelRecording}
            className="h-10 w-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
            data-testid="button-cancel-recording"
            aria-label={t("a11y.cancelRecording")}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={onStopRecording}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-stop-recording"
            aria-label={t("a11y.stopRecording")}
          >
            <Square className="h-5 w-5 fill-current" aria-hidden="true" />
          </Button>
        </div>
      )}

      {!isRecording && audioBlob && (
        <div className="py-2">
          <AudioRecordingPreview
            audioBlob={audioBlob}
            onSend={onSendAudioMessage}
            onDiscard={onCancelRecording}
            isSending={isSending}
          />
        </div>
      )}

      {!isRecording && !audioBlob && (
        <>
          {/* Reply preview */}
          {replyingTo && (
            <ReplyPreview message={replyingTo} onCancel={onCancelReply} />
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsInternalComment(false)}
                className={`h-7 px-2 text-xs ${
                  !isInternalComment
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                data-testid="button-reply-mode"
              >
                {t("inbox.reply")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsInternalComment(true)}
                className={`h-7 px-2 text-xs ${
                  isInternalComment
                    ? "bg-yellow-600 text-white hover:bg-yellow-600/90"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                data-testid="button-internal-mode"
              >
                <AtSign className="mr-1 h-3 w-3" />
                {t("inbox.note")}
              </Button>
            </div>

            {emailTemplates && emailTemplates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    data-testid="button-template-picker"
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    {t("inbox.templates")}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {emailTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => onApplyTemplate(template)}
                      data-testid={`menu-template-${template.id}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{template.subject}</span>
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
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
              data-testid="button-attach-file"
              aria-label={t("a11y.attachFile")}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-6 w-6" aria-hidden="true" />
              )}
            </Button>

            <div
              className={`relative flex flex-1 items-center rounded-[8px] bg-muted py-[9px] pl-2 pr-3 ${
                isInternalComment ? "ring-1 ring-yellow-500/50" : ""
              }`}
            >
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="absolute bottom-14 left-0 z-50">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    theme={resolvedEmojiTheme}
                    width={320}
                    height={400}
                    searchPlaceHolder={t("inbox.emojiSearch")}
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}

              {/* @mentions autocomplete */}
              <MentionAutocomplete
                users={mentionUsers}
                selectedIndex={mentionSelectedIndex}
                visible={mentionActive}
                onSelect={(user) => {
                  const cursorPosition = inputRef.current?.selectionStart ?? newMessage.length;
                  const { text, newCursorPosition } = selectMentionUser(user, newMessage, cursorPosition);
                  setNewMessage(text);
                  // Set cursor position after React updates
                  setTimeout(() => {
                    inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
                    inputRef.current?.focus();
                  }, 0);
                }}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="h-6 w-6 flex-shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                data-testid="button-emoji"
                aria-label={t("a11y.openEmojiPicker")}
                aria-expanded={showEmojiPicker}
              >
                <Smile className="h-[26px] w-[26px]" aria-hidden="true" />
              </Button>

              <input
                ref={inputRef}
                id="message-input"
                type="text"
                placeholder={isInternalComment ? t("common.notes") : t("inbox.typeMessage")}
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  onTyping();
                  // Check for @mentions
                  handleMentionTextChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyDown={(e) => {
                  // Handle mention keyboard navigation
                  if (mentionActive) {
                    const handled = handleMentionKeyDown(e);
                    if (handled && (e.key === "Enter" || e.key === "Tab")) {
                      // Select the current user
                      const selectedUser = getSelectedUser();
                      if (selectedUser) {
                        const cursorPosition = inputRef.current?.selectionStart ?? newMessage.length;
                        const { text, newCursorPosition } = selectMentionUser(selectedUser, newMessage, cursorPosition);
                        setNewMessage(text);
                        setTimeout(() => {
                          inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
                          inputRef.current?.focus();
                        }, 0);
                      }
                    }
                  }
                }}
                className="ml-2 flex-1 border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0"
                style={{ boxShadow: "none" }}
                data-testid="input-message"
              />
            </div>

            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                onClick={onStartRecording}
                className="h-10 w-10 flex-shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                data-testid="button-mic"
                aria-label={t("a11y.startRecording")}
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={isSending || uploading || (!newMessage.trim() && pendingFiles.length === 0)}
                className="h-10 w-10 flex-shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                data-testid="button-send-message"
                aria-label={t("a11y.sendMessage")}
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}
