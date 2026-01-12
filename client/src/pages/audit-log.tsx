import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import {
  Plus,
  Pencil,
  Trash2,
  User,
  Building2,
  Users,
  Kanban,
  Shield,
  Download,
  UserX,
  FileText,
  Link2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLog, AuditLogAction, AuditLogEntityType } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";

type EnrichedAuditLog = AuditLog & {
  user: { id: string; firstName: string | null; lastName: string | null } | null;
};

const actionIcons: Record<AuditLogAction, typeof Plus> = {
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

const entityIcons: Record<AuditLogEntityType, typeof Kanban> = {
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

export default function AuditLogPage() {
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? ptBR : enUS;
  const { data: logs, isLoading } = useQuery<EnrichedAuditLog[]>({
    queryKey: ["/api/audit-logs"],
    queryFn: () => api.get<EnrichedAuditLog[]>("/api/audit-logs"),
  });

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

  const getEntityLabel = (entityType: AuditLogEntityType) => {
    const key = `auditLog.entities.${entityType}`;
    const label = t(key);
    return label === key ? entityType.replace("_", " ") : label;
  };

  const ActionIcon = ({ action }: { action: AuditLogAction }) => {
    const Icon = actionIcons[action];
    return <Icon className="h-4 w-4" />;
  };

  const EntityIcon = ({ entityType }: { entityType: AuditLogEntityType }) => {
    const Icon = entityIcons[entityType] || User;
    return <Icon className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">{t("auditLog.title")}</h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-audit-log-title">
            {t("auditLog.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auditLog.subtitle")}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">{t("auditLog.table.timestamp")}</TableHead>
              <TableHead className="w-[150px]">{t("auditLog.table.user")}</TableHead>
              <TableHead className="w-[100px]">{t("auditLog.table.action")}</TableHead>
              <TableHead className="w-[120px]">{t("auditLog.table.entityType")}</TableHead>
              <TableHead>{t("auditLog.table.entityName")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t("auditLog.empty")}
                </TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.createdAt
                      ? format(new Date(log.createdAt), "Pp", { locale })
                      : "-"}
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
                      className={`gap-1 ${actionColors[log.action as AuditLogAction]}`}
                    >
                      <ActionIcon action={log.action as AuditLogAction} />
                      <span className="capitalize">{getActionLabel(log.action as AuditLogAction)}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EntityIcon entityType={log.entityType as AuditLogEntityType} />
                      <span className="text-sm capitalize">
                        {getEntityLabel(log.entityType as AuditLogEntityType)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.entityName || `#${log.entityId}`}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
