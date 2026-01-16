"use client";

import { Virtuoso } from "react-virtuoso";
import { Search, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FilterPanel, type InboxFilters } from "@/components/filter-panel";
import { useTranslation } from "@/contexts/LanguageContext";
import type { ConversationWithRelations } from "@/lib/api/conversations";

type Props = {
  collapsed: boolean;
  conversationsLoading: boolean;
  filteredConversations: ConversationWithRelations[];
  onSelectConversation: (conversation: ConversationWithRelations) => void;
  selectedConversationId?: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filters: InboxFilters;
  onFiltersChange: (filters: InboxFilters) => void;
  formatTime: (date: Date | string | null) => string;
  onExpandFromRail: () => void;
};

export function ConversationListPanel({
  collapsed,
  conversationsLoading,
  filteredConversations,
  onSelectConversation,
  selectedConversationId,
  searchQuery,
  onSearchQueryChange,
  filters,
  onFiltersChange,
  formatTime,
  onExpandFromRail,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className={collapsed ? "hidden lg:flex h-full flex-col items-center gap-2 px-2 py-3" : "hidden"}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onExpandFromRail}
          title={t("a11y.expandPanel")}
          aria-label={t("a11y.expandPanel")}
          data-testid="button-expand-inbox-list"
        >
          <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <div className={collapsed ? "flex h-full flex-col lg:hidden" : "flex h-full flex-col"}>
        <div className="bg-muted/50 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-medium text-foreground" data-testid="text-inbox-title">
              {t("inbox.title")}
            </h2>
            <FilterPanel
              type="inbox"
              filters={filters}
              onFiltersChange={(f) => onFiltersChange(f as InboxFilters)}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder={t("common.search")}
              className="h-9 w-full rounded-lg border border-border bg-muted pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              style={{ boxShadow: "none" }}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              data-testid="input-inbox-search"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-background">
          {conversationsLoading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 border-b border-border px-3 py-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <Virtuoso
              style={{ height: "100%" }}
              data={filteredConversations}
              itemContent={(_index, conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedConversationId === conversation.id ? "bg-muted" : ""
                  }`}
                  data-testid={`conversation-${conversation.id}`}
                  role="option"
                  aria-selected={selectedConversationId === conversation.id}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                      {conversation.contact
                        ? `${conversation.contact.firstName?.[0] || ""}${conversation.contact.lastName?.[0] || ""}`
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-normal text-foreground">
                        {conversation.contact
                          ? `${conversation.contact.firstName} ${conversation.contact.lastName}`
                          : "Desconhecido"}
                      </span>
                      <span
                        className={`flex-shrink-0 text-xs ${
                          (conversation.unreadCount || 0) > 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] text-muted-foreground">
                        {conversation.subject || "Sem assunto"}
                      </p>
                      {(conversation.unreadCount || 0) > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              {t("inbox.noConversations")}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
