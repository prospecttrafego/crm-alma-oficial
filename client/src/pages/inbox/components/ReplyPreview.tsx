"use client";

import { Reply, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import type { InboxMessage } from "@/pages/inbox/types";

type Props = {
  message: InboxMessage;
  onCancel: () => void;
};

/**
 * Displays a preview of the message being replied to in the composer.
 * Shows sender name, content preview, and a cancel button.
 */
export function ReplyPreview({ message, onCancel }: Props) {
  const { t } = useTranslation();

  // Get sender name
  let senderName = t("inbox.contextPanel.contact");
  if (message.senderType === "user") {
    if (message.sender) {
      const fullName = [message.sender.firstName, message.sender.lastName]
        .filter(Boolean)
        .join(" ");
      senderName = fullName || message.sender.email || t("common.user");
    }
  } else if (message.senderType === "system") {
    senderName = "System";
  }

  // Truncate content
  const truncatedContent =
    message.content && message.content.length > 80
      ? message.content.slice(0, 80) + "..."
      : message.content;

  return (
    <div className="flex items-center gap-2 rounded-t-lg border-b border-border bg-muted/80 px-3 py-2">
      <Reply className="h-4 w-4 flex-shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-primary">{senderName}</span>
        <p className="truncate text-xs text-muted-foreground">{truncatedContent}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={t("common.cancel")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
