import { useState, useMemo, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { auditLogActions, auditLogEntityTypes, type AuditLogAction, type AuditLogEntityType } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";
import { auditLogsApi, type AuditLogsQueryParams, type PaginatedAuditLogs } from "@/lib/api/auditLogs";
import { usersApi } from "@/lib/api";
import type { EnrichedAuditLog, SafeUser } from "@shared/types";

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

const ITEMS_PER_PAGE = 50;

export default function AuditLogPage() {
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? ptBR : enUS;

  // Filter state
  const [filters, setFilters] = useState<AuditLogsQueryParams>({
    page: 1,
    limit: ITEMS_PER_PAGE,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Date picker state
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  // Fetch users for filter dropdown
  const { data: users } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => usersApi.list(),
  });

  // Fetch audit logs with filters
  const { data: result, isLoading } = useQuery<PaginatedAuditLogs>({
    queryKey: ["/api/audit-logs", filters],
    queryFn: () => auditLogsApi.list(filters),
  });

  const logs = useMemo(() => result?.data ?? [], [result?.data]);
  const pagination = result?.pagination;

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(filters.action || filters.entityType || filters.userId || filters.dateFrom || filters.dateTo);
  }, [filters]);

  // Update filter
  const updateFilter = useCallback((key: keyof AuditLogsQueryParams, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? value as number : 1, // Reset page when filter changes
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ page: 1, limit: ITEMS_PER_PAGE });
  }, []);

  const formatUserName = useCallback((user: EnrichedAuditLog["user"]) => {
    if (!user) return t("auditLog.system");
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName || t("auditLog.unknownUser");
  }, [t]);

  const getActionLabel = useCallback((action: AuditLogAction) => {
    const key = `auditLog.actions.${action}`;
    const label = t(key);
    return label === key ? action : label;
  }, [t]);

  const getEntityLabel = useCallback((entityType: AuditLogEntityType) => {
    const key = `auditLog.entities.${entityType}`;
    const label = t(key);
    return label === key ? entityType.replace("_", " ") : label;
  }, [t]);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (!logs.length) return;

    const escapeCsvCell = (value: unknown) => {
      const raw = String(value ?? "");
      // Mitigate CSV injection (Excel/Sheets formula execution)
      const trimmed = raw.trimStart();
      const safe = /^[=+@-]/.test(trimmed) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const headers = [
      t("auditLog.table.timestamp"),
      t("auditLog.table.user"),
      t("auditLog.table.action"),
      t("auditLog.table.entityType"),
      t("auditLog.table.entityName"),
    ];

    const rows = logs.map((log) => [
      log.createdAt ? format(new Date(log.createdAt), "Pp", { locale }) : "-",
      formatUserName(log.user),
      getActionLabel(log.action as AuditLogAction),
      getEntityLabel(log.entityType as AuditLogEntityType),
      log.entityName || `#${log.entityId}`,
    ]);

    const csvContent = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [logs, t, locale, formatUserName, getActionLabel, getEntityLabel]);

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
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {t("auditLog.filters.title")}
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                !
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            disabled={!logs.length}
            className="gap-2"
            aria-label={t("auditLog.exportCsv")}
          >
            <Download className="h-4 w-4" />
            {t("auditLog.exportCsv")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
          {/* Action filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("auditLog.filters.action")}</label>
            <Select
              value={filters.action || "all"}
              onValueChange={(value) => updateFilter("action", value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("auditLog.filters.allActions")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("auditLog.filters.allActions")}</SelectItem>
                {auditLogActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {getActionLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity type filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("auditLog.filters.entityType")}</label>
            <Select
              value={filters.entityType || "all"}
              onValueChange={(value) => updateFilter("entityType", value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("auditLog.filters.allEntities")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("auditLog.filters.allEntities")}</SelectItem>
                {auditLogEntityTypes.map((entityType) => (
                  <SelectItem key={entityType} value={entityType}>
                    {getEntityLabel(entityType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("auditLog.filters.user")}</label>
            <Select
              value={filters.userId || "all"}
              onValueChange={(value) => updateFilter("userId", value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("auditLog.filters.allUsers")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("auditLog.filters.allUsers")}</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("auditLog.filters.dateFrom")}</label>
            <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(new Date(filters.dateFrom), "P", { locale }) : t("auditLog.filters.selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                  onSelect={(date) => {
                    updateFilter("dateFrom", date ? format(date, "yyyy-MM-dd") : undefined);
                    setDateFromOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{t("auditLog.filters.dateTo")}</label>
            <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(new Date(filters.dateTo), "P", { locale }) : t("auditLog.filters.selectDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={(date) => {
                    updateFilter("dateTo", date ? format(date, "yyyy-MM-dd") : undefined);
                    setDateToOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-transparent">Clear</label>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                {t("auditLog.filters.clear")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results summary */}
      {pagination && (
        <div className="mb-3 text-sm text-muted-foreground">
          {t("auditLog.showing", {
            from: ((pagination.page - 1) * pagination.limit) + 1,
            to: Math.min(pagination.page * pagination.limit, pagination.total),
            total: pagination.total,
          })}
        </div>
      )}

      {/* Table */}
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
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {hasActiveFilters ? t("auditLog.noResults") : t("auditLog.empty")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {t("auditLog.pagination.page", { current: pagination.page, total: pagination.totalPages })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter("page", pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("auditLog.pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilter("page", pagination.page + 1)}
              disabled={!pagination.hasMore}
            >
              {t("auditLog.pagination.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
