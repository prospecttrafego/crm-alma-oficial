/**
 * Hook for @mentions autocomplete functionality
 * Detects @ symbol in text and provides user suggestions
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";

export interface MentionUser {
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string | null;
}

export interface MentionState {
  isActive: boolean;
  query: string;
  startPosition: number;
  selectedIndex: number;
}

const initialState: MentionState = {
  isActive: false,
  query: "",
  startPosition: -1,
  selectedIndex: 0,
};

/**
 * Extracts mention query from text at cursor position
 * Returns null if not in a mention context
 */
function extractMentionQuery(text: string, cursorPosition: number): { query: string; startPosition: number } | null {
  // Look backwards from cursor to find @
  let start = cursorPosition - 1;

  while (start >= 0) {
    const char = text[start];

    // Found the @ symbol
    if (char === "@") {
      const query = text.slice(start + 1, cursorPosition);
      // Only valid if query doesn't contain spaces (single word mention)
      if (!query.includes(" ")) {
        return { query, startPosition: start };
      }
      return null;
    }

    // Space or newline means we're not in a mention
    if (char === " " || char === "\n") {
      return null;
    }

    start--;
  }

  return null;
}

/**
 * Hook for managing @mentions autocomplete
 */
export function useMentionAutocomplete() {
  const [state, setState] = useState<MentionState>(initialState);

  // Fetch users for autocomplete
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => usersApi.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transform users to MentionUser format
  const mentionUsers: MentionUser[] = useMemo(() => {
    return users.map((user) => ({
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User",
      email: user.email || "",
      profileImageUrl: user.profileImageUrl,
    }));
  }, [users]);

  // Filter users based on query
  const filteredUsers = useMemo(() => {
    if (!state.isActive || !state.query) {
      return mentionUsers.slice(0, 5);
    }

    const lowerQuery = state.query.toLowerCase();
    return mentionUsers
      .filter(
        (user) =>
          user.name.toLowerCase().includes(lowerQuery) ||
          user.email.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5);
  }, [mentionUsers, state.isActive, state.query]);

  /**
   * Handle text change - detect if we're in a mention context
   */
  const handleTextChange = useCallback((text: string, cursorPosition: number) => {
    const mentionContext = extractMentionQuery(text, cursorPosition);

    if (mentionContext) {
      setState({
        isActive: true,
        query: mentionContext.query,
        startPosition: mentionContext.startPosition,
        selectedIndex: 0,
      });
    } else {
      setState(initialState);
    }
  }, []);

  /**
   * Handle keyboard navigation
   * Returns true if the key was handled
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!state.isActive) return false;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, filteredUsers.length - 1),
          }));
          return true;

        case "ArrowUp":
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          return true;

        case "Enter":
        case "Tab":
          if (filteredUsers.length > 0) {
            e.preventDefault();
            return true; // Signal that selection should happen
          }
          return false;

        case "Escape":
          e.preventDefault();
          setState(initialState);
          return true;

        default:
          return false;
      }
    },
    [state.isActive, filteredUsers.length]
  );

  /**
   * Get the selected user (for Enter/Tab handling)
   */
  const getSelectedUser = useCallback((): MentionUser | null => {
    if (!state.isActive || filteredUsers.length === 0) return null;
    return filteredUsers[state.selectedIndex] || null;
  }, [state.isActive, state.selectedIndex, filteredUsers]);

  /**
   * Select a user and generate the replacement text
   * Returns the new text with mention inserted
   */
  const selectUser = useCallback(
    (user: MentionUser, currentText: string, cursorPosition: number): { text: string; newCursorPosition: number } => {
      // Find the @ position
      const mentionContext = extractMentionQuery(currentText, cursorPosition);
      if (!mentionContext) {
        return { text: currentText, newCursorPosition: cursorPosition };
      }

      // Format: @[Name](userId)
      const mention = `@[${user.name}](${user.id}) `;

      // Replace the @query with the formatted mention
      const before = currentText.slice(0, mentionContext.startPosition);
      const after = currentText.slice(cursorPosition);
      const newText = before + mention + after;
      const newCursorPosition = before.length + mention.length;

      // Reset state
      setState(initialState);

      return { text: newText, newCursorPosition };
    },
    []
  );

  /**
   * Close the autocomplete
   */
  const close = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // State
    isActive: state.isActive,
    query: state.query,
    selectedIndex: state.selectedIndex,
    filteredUsers,

    // Actions
    handleTextChange,
    handleKeyDown,
    getSelectedUser,
    selectUser,
    close,
  };
}

/**
 * Parse mentions from message content
 * Extracts @[Name](userId) patterns
 */
export function parseMentions(content: string): Array<{ userId: string; name: string; start: number; end: number }> {
  const mentions: Array<{ userId: string; name: string; start: number; end: number }> = [];
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.push({
      name: match[1],
      userId: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Render content with highlighted mentions
 * Returns array of text parts and mention parts
 */
export function renderMentionedContent(content: string): Array<{ type: "text" | "mention"; value: string; userId?: string }> {
  const mentions = parseMentions(content);
  const parts: Array<{ type: "text" | "mention"; value: string; userId?: string }> = [];

  let lastIndex = 0;

  for (const mention of mentions) {
    // Add text before mention
    if (mention.start > lastIndex) {
      parts.push({
        type: "text",
        value: content.slice(lastIndex, mention.start),
      });
    }

    // Add mention
    parts.push({
      type: "mention",
      value: `@${mention.name}`,
      userId: mention.userId,
    });

    lastIndex = mention.end;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      value: content.slice(lastIndex),
    });
  }

  return parts;
}
