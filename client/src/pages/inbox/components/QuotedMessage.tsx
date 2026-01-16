"use client";

import { Reply } from "lucide-react";
import type { QuotedMessage as QuotedMessageType } from "@shared/apiSchemas";

type Props = {
  message: QuotedMessageType;
  /** Whether this is inside a user's message (primary background) */
  isUserMessage?: boolean;
};

/**
 * Displays a quoted/replied-to message within a message bubble.
 * Shows a compact preview of the original message being replied to.
 */
export function QuotedMessage({ message, isUserMessage }: Props) {
  // Truncate content if too long
  const truncatedContent =
    message.content.length > 100
      ? message.content.slice(0, 100) + "..."
      : message.content;

  return (
    <div
      className={`mb-2 flex items-start gap-2 rounded-md border-l-2 px-2 py-1.5 text-xs ${
        isUserMessage
          ? "border-primary-foreground/50 bg-primary-foreground/10"
          : "border-primary/50 bg-muted-foreground/10"
      }`}
    >
      <Reply className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-60" />
      <div className="min-w-0 flex-1">
        {message.senderName && (
          <span
            className={`font-medium ${
              isUserMessage ? "text-primary-foreground/80" : "text-foreground/80"
            }`}
          >
            {message.senderName}
          </span>
        )}
        <p
          className={`line-clamp-2 whitespace-pre-wrap break-words ${
            isUserMessage ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {truncatedContent}
        </p>
      </div>
    </div>
  );
}
