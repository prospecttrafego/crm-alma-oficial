"use client";

import { useState, useCallback } from "react";
import { MoreHorizontal, Pencil, Trash2, Reply, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type MessageActionsProps = {
  messageId: number;
  content: string | null;
  createdAt: Date | string | null;
  isUserMessage: boolean;
  onEdit: (messageId: number) => void;
  onDelete: (messageId: number) => Promise<void>;
  onReply: (messageId: number) => void;
};

/**
 * Check if the message is within the edit window (15 minutes)
 */
function canEditMessage(createdAt: Date | string | null): boolean {
  if (!createdAt) return false;
  const messageTime = new Date(createdAt).getTime();
  return Date.now() - messageTime <= EDIT_WINDOW_MS;
}

/**
 * Message actions dropdown menu (edit, delete, reply, copy)
 * Only shows edit/delete for user's own messages within the edit window
 */
export function MessageActions({
  messageId,
  content,
  createdAt,
  isUserMessage,
  onEdit,
  onDelete,
  onReply,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = isUserMessage && canEditMessage(createdAt);

  const handleCopy = useCallback(async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      toast({
        description: "Copied to clipboard",
      });
    }
  }, [content, toast]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete(messageId);
      setIsDeleteDialogOpen(false);
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to delete message",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [messageId, onDelete, toast]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">{t("common.actions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isUserMessage ? "end" : "start"}>
          <DropdownMenuItem onClick={() => onReply(messageId)}>
            <Reply className="mr-2 h-4 w-4" />
            {t("inbox.messageActions.reply")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {t("inbox.messageActions.copy")}
          </DropdownMenuItem>

          {isUserMessage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onEdit(messageId)}
                disabled={!canEdit}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("inbox.messageActions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("inbox.messageActions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("inbox.deleteMessage.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("inbox.deleteMessage.confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("common.loading") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
