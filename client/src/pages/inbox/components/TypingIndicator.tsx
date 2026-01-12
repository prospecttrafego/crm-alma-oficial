"use client";

import type { TypingUser } from "@/pages/inbox/types";

type Props = {
  typingUsers: TypingUser[];
};

export function TypingIndicator({ typingUsers }: Props) {
  if (typingUsers.length === 0) return null;

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex gap-1">
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <span>
          {typingUsers.length === 1
            ? `${typingUsers[0].userName || "Alguém"} está digitando...`
            : `${typingUsers.length} pessoas estão digitando...`}
        </span>
      </div>
    </div>
  );
}
