"use client";

import { MessageSquare } from "lucide-react";

import { useTranslation } from "@/contexts/LanguageContext";

export function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="hidden flex-1 items-center justify-center bg-background md:flex">
      <div className="text-center">
        <MessageSquare className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
        <p className="text-lg text-foreground">{t("inbox.noMessagesDescription")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">j</kbd>/
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">k</kbd>{" "}
          para navegar
        </p>
      </div>
    </div>
  );
}

