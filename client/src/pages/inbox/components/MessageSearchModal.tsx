"use client";

import { useEffect, useRef } from "react";
import { Search, X, Loader2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/LanguageContext";
import { useMessageSearch } from "@/hooks/useMessageSearch";
import type { MessageSearchResult } from "@/lib/api/conversations";

type Props = {
  open: boolean;
  onClose: () => void;
  conversationId?: number;
  onSelectMessage: (result: MessageSearchResult) => void;
};

/**
 * Modal for searching messages in inbox
 * Supports searching within a specific conversation or globally
 */
export function MessageSearchModal({ open, onClose, conversationId, onSelectMessage }: Props) {
  const { t, language } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = language === "pt-BR" ? ptBR : enUS;

  const {
    query,
    setQuery,
    results,
    total,
    isLoading,
    hasMore,
    loadMore,
    reset,
  } = useMessageSearch({ conversationId, enabled: open });

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      reset();
    }
  }, [open, reset]);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && !open) {
        e.preventDefault();
        // This would need to be triggered from parent
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSelect = (result: MessageSearchResult) => {
    onSelectMessage(result);
    onClose();
  };

  const highlightMatch = (content: string, searchQuery: string) => {
    if (!searchQuery) return content;

    // Escape regex special characters to prevent crashes
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = content.split(new RegExp(`(${escapedQuery})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-foreground">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("inbox.searchMessages")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("inbox.searchPlaceholder")}
              className="pl-9 pr-9"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px]">
            {isLoading && query.length >= 2 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && query.length >= 2 && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2" />
                <p>{t("common.noResults")}</p>
              </div>
            )}

            {query.length < 2 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mb-2" />
                <p>{t("inbox.searchMinChars")}</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1 mb-2">
                  {t("inbox.searchResults", { count: total })}
                </p>
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelect(result)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {result.conversationSubject || t("inbox.noSubject")}
                      </span>
                      {result.createdAt && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(result.createdAt), {
                            addSuffix: true,
                            locale,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {highlightMatch(result.content, query)}
                    </p>
                    {result.senderName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.senderName}
                      </p>
                    )}
                  </button>
                ))}

                {hasMore && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t("common.loadMore")}
                  </Button>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
