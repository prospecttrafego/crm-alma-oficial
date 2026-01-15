"use client";

import { ArrowLeft, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import type { ConversationWithRelations } from "@/lib/api/conversations";

type Props = {
  conversation: ConversationWithRelations;
  onBack: () => void;
  listPanelCollapsed: boolean;
  onToggleListPanel: () => void;
  contextPanelCollapsed: boolean;
  onToggleContextPanel: () => void;
  onSearchClick?: () => void;
};

export function ThreadHeader({
  conversation,
  onBack,
  listPanelCollapsed,
  onToggleListPanel,
  contextPanelCollapsed,
  onToggleContextPanel,
  onSearchClick,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 text-muted-foreground hover:text-foreground md:hidden"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleListPanel}
          className="hidden h-10 w-10 text-muted-foreground hover:text-foreground lg:inline-flex"
          title={listPanelCollapsed ? "Expandir painel" : "Recolher painel"}
          data-testid="button-toggle-inbox-list-panel"
        >
          {listPanelCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>

        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
            {conversation.contact
              ? `${conversation.contact.firstName?.[0] || ""}${conversation.contact.lastName?.[0] || ""}`
              : "?"}
          </AvatarFallback>
        </Avatar>

        <div>
          <h3 className="text-[15px] font-medium text-foreground">
            {conversation.contact
              ? `${conversation.contact.firstName} ${conversation.contact.lastName}`
              : "Desconhecido"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {conversation.subject || "Clique para ver informações do contato"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleContextPanel}
          className="hidden h-10 w-10 text-muted-foreground hover:text-foreground lg:inline-flex"
          title={contextPanelCollapsed ? "Expandir painel" : "Recolher painel"}
          data-testid="button-toggle-inbox-context-panel"
        >
          {contextPanelCollapsed ? (
            <PanelRightOpen className="h-5 w-5" />
          ) : (
            <PanelRightClose className="h-5 w-5" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onSearchClick}
          className="h-10 w-10 text-muted-foreground hover:text-foreground"
          aria-label={t("common.search")}
          title={`${t("inbox.searchMessages")} (⌘F)`}
          data-testid="button-search"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
