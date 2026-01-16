"use client";

import { useState, useEffect, useCallback } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type EditMessageModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: number | null;
  currentContent: string;
  createdAt: Date | string | null;
  onSave: (messageId: number, newContent: string) => Promise<void>;
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
 * Modal for editing a message
 */
export function EditMessageModal({
  open,
  onOpenChange,
  messageId,
  currentContent,
  createdAt,
  onSave,
}: EditMessageModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [content, setContent] = useState(currentContent);
  const [isSaving, setIsSaving] = useState(false);

  // Reset content when modal opens with new message
  useEffect(() => {
    if (open) {
      setContent(currentContent);
    }
  }, [open, currentContent]);

  const canEdit = canEditMessage(createdAt);
  const hasChanges = content.trim() !== currentContent.trim();
  const isValid = content.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!messageId || !isValid || !hasChanges) return;

    if (!canEdit) {
      toast({
        variant: "destructive",
        description: t("inbox.editMessage.expired"),
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave(messageId, content.trim());
      onOpenChange(false);
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to edit message",
      });
    } finally {
      setIsSaving(false);
    }
  }, [messageId, content, isValid, hasChanges, canEdit, onSave, onOpenChange, toast, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter or Ctrl+Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("inbox.editMessage.title")}</DialogTitle>
          <DialogDescription>
            {!canEdit && (
              <span className="text-destructive">
                {t("inbox.editMessage.expired")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inbox.editMessage.placeholder")}
            className="min-h-[120px] resize-none"
            disabled={!canEdit || isSaving}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("inbox.editMessage.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canEdit || !isValid || !hasChanges || isSaving}
          >
            {isSaving ? t("common.saving") : t("inbox.editMessage.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
