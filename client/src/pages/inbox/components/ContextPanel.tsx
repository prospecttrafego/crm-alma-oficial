"use client";

import { Building2, MessageSquare, User } from "lucide-react";

import { useTranslation } from "@/contexts/LanguageContext";
import type { ConversationWithRelations } from "@/lib/api/conversations";

type Props = {
  conversation: ConversationWithRelations;
  collapsed: boolean;
  getChannelLabel: (channel: string) => string;
  getStatusLabel: (status: string) => string;
};

export function ContextPanel({ conversation, collapsed, getChannelLabel, getStatusLabel }: Props) {
  const { t, language } = useTranslation();

  if (collapsed) {
    return <div className="flex h-full flex-col" />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: language === "pt-BR" ? "BRL" : "USD",
    }).format(value);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h4 className="text-sm font-medium text-foreground">{t("inbox.contextPanel.title")}</h4>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {conversation.contact && (
          <div className="mb-4 rounded-lg bg-muted p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-4 w-4" />
              {t("inbox.contextPanel.contact")}
            </div>
            <p className="text-sm font-medium text-foreground">
              {conversation.contact.firstName} {conversation.contact.lastName}
            </p>
            {conversation.contact.email && (
              <p className="text-xs text-muted-foreground">{conversation.contact.email}</p>
            )}
            {conversation.contact.phone && (
              <p className="text-xs text-muted-foreground">{conversation.contact.phone}</p>
            )}
          </div>
        )}

        {conversation.deal && (
          <div className="mb-4 rounded-lg bg-muted p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {t("inbox.contextPanel.relatedDeal")}
            </div>
            <p className="text-sm font-medium text-foreground">{conversation.deal.title}</p>
            {conversation.deal.value && (
              <p className="text-xs text-primary">
                {formatCurrency(Number(conversation.deal.value))}
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg bg-muted p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            {t("inbox.contextPanel.conversationInfo")}
          </div>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              {t("inbox.contextPanel.channel")}: <span className="text-foreground">{getChannelLabel(conversation.channel)}</span>
            </p>
            <p className="text-muted-foreground">
              {t("inbox.contextPanel.status")}:{" "}
              <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                {getStatusLabel(conversation.status || "open")}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

