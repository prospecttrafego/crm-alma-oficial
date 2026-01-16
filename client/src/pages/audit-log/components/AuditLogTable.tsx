import { TableVirtuoso } from "react-virtuoso";
import {
  Building2,
  Download,
  FileText,
  HelpCircle,
  Kanban,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/contexts/LanguageContext";
import { auditLogActions, auditLogEntityTypes, type AuditLogAction, type AuditLogEntityType } from "@shared/schema";
import type { EnrichedAuditLog } from "@shared/types";
import { cn } from "@/lib/utils";

const actionIcons: Record<AuditLogAction, LucideIcon> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  lgpd_export: Download,
  lgpd_delete: UserX,
};

const actionColors: Record<AuditLogAction, string> = {
  create: "bg-green-500/10 text-green-500",
  update: "bg-blue-500/10 text-blue-500",
  delete: "bg-red-500/10 text-red-500",
  lgpd_export: "bg-primary/10 text-primary",
  lgpd_delete: "bg-orange-500/10 text-orange-500",
};

const entityIcons: Record<AuditLogEntityType, LucideIcon> = {
  deal: Kanban,
  contact: Users,
  company: Building2,
  conversation: User,
  activity: User,
  pipeline: Kanban,
  email_template: User,
  file: FileText,
  integration: Link2,
};

type Props = {
  logs: EnrichedAuditLog[];
  emptyLabel: string;
  dateTimeFormatter: Intl.DateTimeFormat;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export function AuditLogTable({ logs, emptyLabel, dateTimeFormatter, hasNextPage, isFetchingNextPage, onLoadMore }: Props) {
  const { t } = useTranslation();

  const getActionLabel = (action: AuditLogAction) => {
    const key = `auditLog.actions.${action}`;
    const label = t(key);
    return label === key ? action : label;
  };

  const getEntityLabel = (entityType: AuditLogEntityType) => {
    const key = `auditLog.entities.${entityType}`;
    const label = t(key);
    return label === key ? entityType.replace("_", " ") : label;
  };

  const formatUserName = (user: EnrichedAuditLog["user"]) => {
    if (!user) return t("auditLog.system");
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.firstName || t("auditLog.unknownUser");
  };

  return (
    <TableVirtuoso
      style={{ height: "100%" }}
      data={logs}
      computeItemKey={(_index, log) => log.id}
      endReached={() => {
        if (hasNextPage && !isFetchingNextPage) onLoadMore();
      }}
      components={{
        EmptyPlaceholder: () => (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ),
        Scroller: (props) => <div {...(props as any)} className="min-h-0 flex-1 overflow-auto rounded-md border" />,
        Table: (props) => <table {...props} className="w-full caption-bottom text-sm" />,
        TableHead: (props) => <TableHeader {...(props as any)} />,
        TableRow: ({ item, ...props }) => <TableRow {...(props as any)} data-testid={`row-audit-log-${item.id}`} />,
      }}
      fixedHeaderContent={() => (
        <TableRow>
          <TableHead className="w-[180px]">{t("auditLog.table.timestamp")}</TableHead>
          <TableHead className="w-[150px]">{t("auditLog.table.user")}</TableHead>
          <TableHead className="w-[120px]">{t("auditLog.table.action")}</TableHead>
          <TableHead className="w-[140px]">{t("auditLog.table.entityType")}</TableHead>
          <TableHead>{t("auditLog.table.entityName")}</TableHead>
        </TableRow>
      )}
      fixedFooterContent={() =>
        isFetchingNextPage ? (
          <TableRow>
            <TableCell colSpan={5} className="py-3 text-center text-sm text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.loading")}
              </div>
            </TableCell>
          </TableRow>
        ) : null
      }
      itemContent={(_index, log) => {
        const action = auditLogActions.includes(log.action as AuditLogAction) ? (log.action as AuditLogAction) : null;
        const entityType = auditLogEntityTypes.includes(log.entityType as AuditLogEntityType)
          ? (log.entityType as AuditLogEntityType)
          : null;

        const ActionIcon = action ? actionIcons[action] : HelpCircle;
        const EntityIcon = entityType ? entityIcons[entityType] : HelpCircle;
        const actionLabel = action ? getActionLabel(action) : String(log.action);
        const entityLabel = entityType ? getEntityLabel(entityType) : String(log.entityType);

        return (
          <>
            <TableCell className="text-sm text-muted-foreground">
              {log.createdAt ? dateTimeFormatter.format(new Date(log.createdAt)) : "-"}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatUserName(log.user)}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={cn("gap-1", action ? actionColors[action] : "bg-muted text-muted-foreground")}
              >
                <ActionIcon className="h-4 w-4" />
                <span className="capitalize">{actionLabel}</span>
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <EntityIcon className="h-4 w-4" />
                <span className="text-sm capitalize">{entityLabel}</span>
              </div>
            </TableCell>
            <TableCell className="font-medium">{log.entityName || `#${log.entityId}`}</TableCell>
          </>
        );
      }}
    />
  );
}
