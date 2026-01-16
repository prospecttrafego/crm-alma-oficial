"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MentionUser } from "@/hooks/useMentionAutocomplete";

type Props = {
  users: MentionUser[];
  selectedIndex: number;
  onSelect: (user: MentionUser) => void;
  visible: boolean;
};

/**
 * Autocomplete dropdown for @mentions
 * Shows list of users matching the query
 */
export const MentionAutocomplete = forwardRef<HTMLDivElement, Props>(function MentionAutocomplete(
  { users, selectedIndex, onSelect, visible },
  ref
) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!visible || !listRef.current) return;

    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, visible]);

  if (!visible || users.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {users.map((user, index) => {
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <button
              key={user.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              )}
              onClick={() => onSelect(user)}
              onMouseEnter={() => {
                // Optional: update selection on hover
              }}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.name} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
