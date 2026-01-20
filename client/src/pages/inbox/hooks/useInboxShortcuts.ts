import { useEffect, useRef } from "react";
import type { ConversationWithRelations } from "@/lib/api/conversations";

interface UseInboxShortcutsOptions {
  selectedConversation: ConversationWithRelations | null;
  filteredConversations: ConversationWithRelations[];
  setSelectedConversation: (conversation: ConversationWithRelations | null) => void;
  setIsInternalComment: (value: boolean) => void;
  onOpenSearch: () => void;
}

export function useInboxShortcuts({
  selectedConversation,
  filteredConversations,
  setSelectedConversation,
  setIsInternalComment,
  onOpenSearch,
}: UseInboxShortcutsOptions) {
  const selectedConversationRef = useRef(selectedConversation);
  const filteredConversationsRef = useRef(filteredConversations);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    filteredConversationsRef.current = filteredConversations;
  }, [filteredConversations]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT";

      // Cmd/Ctrl+F to open search modal (override browser's default)
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      if (e.key === "j" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversationsRef.current || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversationRef.current
          ? list.findIndex((c) => c.id === selectedConversationRef.current?.id)
          : -1;
        const nextIndex = currentIndex < list.length - 1 ? currentIndex + 1 : currentIndex;
        if (list[nextIndex]) {
          setSelectedConversation(list[nextIndex]);
        }
      }

      if (e.key === "k" && !e.metaKey && !e.ctrlKey && !isTyping) {
        e.preventDefault();
        const list = filteredConversationsRef.current || [];
        if (list.length === 0) return;
        const currentIndex = selectedConversationRef.current
          ? list.findIndex((c) => c.id === selectedConversationRef.current?.id)
          : list.length;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        if (list[prevIndex]) {
          setSelectedConversation(list[prevIndex]);
        }
      }

      // Escape to deselect conversation (go back to list)
      if (e.key === "Escape" && !isTyping && selectedConversationRef.current) {
        e.preventDefault();
        setSelectedConversation(null);
        return;
      }

      if (!selectedConversationRef.current) return;
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
  }, [setSelectedConversation, setIsInternalComment, onOpenSearch]);
}
