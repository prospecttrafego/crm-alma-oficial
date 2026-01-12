import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Plus, Pencil, Trash2, Clock, Download, UserX } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog, AuditLogAction, AuditLogEntityType } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

type EnrichedAuditLog = AuditLog & {
  user: { id: string; firstName: string | null; lastName: string | null } | null;
};

interface EntityHistoryProps {
  entityType: AuditLogEntityType;
  entityId: number;
}

const actionIcons: Record<AuditLogAction, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  lgpd_export: Download,
  lgpd_delete: UserX,
};

const actionColors: Record<AuditLogAction, string> = {
  create: "text-green-500",
  update: "text-blue-500",
  delete: "text-red-500",
  lgpd_export: "text-purple-500",
  lgpd_delete: "text-orange-500",
};

export function EntityHistory({ entityType, entityId }: EntityHistoryProps) {
  const { data: logs, isLoading } = useQuery<EnrichedAuditLog[]>({
    queryKey: ["/api/audit-logs/entity", entityType, entityId],
    queryFn: () => api.get<EnrichedAuditLog[]>(`/api/audit-logs/entity/${entityType}/${entityId}`),
  });
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? ptBR : enUS;

  const formatUserName = (user: EnrichedAuditLog["user"]) => {
    if (!user) return t("auditLog.system");
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName || t("auditLog.unknownUser");
  };

  const getActionLabel = (action: AuditLogAction) => {
    const key = `auditLog.actions.${action}`;
    const label = t(key);
    return label === key ? action : label;
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{t("entityHistory.title")}</span>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
          <Clock className="h-4 w-4" />
          <span>{t("entityHistory.title")}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("entityHistory.empty")}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
        <Clock className="h-4 w-4" />
        <span>{t("entityHistory.title")}</span>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="space-y-3">
          {logs.map((log) => {
            const ActionIcon = actionIcons[log.action as AuditLogAction];
            const actionColor = actionColors[log.action as AuditLogAction];
            const actionLabel = getActionLabel(log.action as AuditLogAction);

            return (
              <div
                key={log.id}
                className="flex items-start gap-3"
                data-testid={`history-item-${log.id}`}
              >
                <div className={`mt-0.5 ${actionColor}`}>
                  <ActionIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{actionLabel}</span>
                    {` ${t("auditLog.by")} `}
                    <span className="text-muted-foreground">{formatUserName(log.user)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.createdAt
                      ? format(new Date(log.createdAt), "Pp", { locale })
                      : "-"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
