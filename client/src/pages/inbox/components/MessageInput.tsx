"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EmojiClickData } from "emoji-picker-react";
import { AtSign, ChevronDown, FileText, Loader2, Mic, Plus, Send, Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "@/contexts/LanguageContext";
import { useMentionAutocomplete } from "@/hooks/useMentionAutocomplete";
import type { InboxMessage, PendingFile } from "@/pages/inbox/types";
import type { EmailTemplate } from "@shared/schema";

import { ReplyPreview } from "./ReplyPreview";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { LazyEmojiPicker } from "./LazyEmojiPicker";
import { FileAttachments } from "./FileAttachments";

type Props = {
  isInternalComment: boolean;
  setIsInternalComment: (value: boolean) => void;
  emailTemplates: EmailTemplate[] | undefined;
  onApplyTemplate: (template: EmailTemplate) => void;
  pendingFiles: PendingFile[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingFile: (fileId: string) => void;
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  onTyping: () => void;
  onStartRecording: () => void;
  isSending: boolean;
  replyingTo: InboxMessage | null;
  onCancelReply: () => void;
};

export function MessageInput({
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
  isSending,
  replyingTo,
  onCancelReply,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (theme === "dark") return "dark" as const;
    if (theme === "light") return "light" as const;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? ("dark" as const) : ("light" as const);
  }, [theme]);

  const onEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      setNewMessage((prev) => prev + emojiData.emoji);
      setShowEmojiPicker(false);
    },
    [setNewMessage],
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
    <>
      {replyingTo && <ReplyPreview message={replyingTo} onCancel={onCancelReply} />}

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
            <AtSign className="mr-1 h-3 w-3" aria-hidden="true" />
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
                <FileText className="mr-1 h-3 w-3" aria-hidden="true" />
                {t("inbox.templates")}
                <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
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

      <FileAttachments
        pendingFiles={pendingFiles}
        fileInputRef={fileInputRef}
        onFileSelect={onFileSelect}
        onRemovePendingFile={onRemovePendingFile}
      />

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
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Plus className="h-6 w-6" aria-hidden="true" />}
        </Button>

        <div
          className={`relative flex flex-1 items-center rounded-[8px] bg-muted py-[9px] pl-2 pr-3 ${
            isInternalComment ? "ring-1 ring-yellow-500/50" : ""
          }`}
        >
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-14 left-0 z-50">
              <LazyEmojiPicker onEmojiClick={onEmojiClick} theme={resolvedEmojiTheme} searchPlaceholder={t("inbox.emojiSearch")} />
            </div>
          )}

          <MentionAutocomplete
            users={mentionUsers}
            selectedIndex={mentionSelectedIndex}
            visible={mentionActive}
            onSelect={(user) => {
              const cursorPosition = inputRef.current?.selectionStart ?? newMessage.length;
              const { text, newCursorPosition } = selectMentionUser(user, newMessage, cursorPosition);
              setNewMessage(text);
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
            onChange={(event) => {
              setNewMessage(event.target.value);
              onTyping();
              handleMentionTextChange(event.target.value, event.target.selectionStart ?? event.target.value.length);
            }}
            onKeyDown={(event) => {
              if (!mentionActive) return;

              const handled = handleMentionKeyDown(event);
              if (handled && (event.key === "Enter" || event.key === "Tab")) {
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
  );
}

