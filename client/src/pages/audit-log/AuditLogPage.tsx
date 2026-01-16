import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Download, Filter, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { auditLogsApi, type AuditLogsQueryParams } from "@/lib/api/auditLogs";
import { usersApi } from "@/lib/api";
import type { EnrichedAuditLog, SafeUser } from "@shared/types";

import { AuditLogFilters } from "./components/AuditLogFilters";
import { AuditLogTable } from "./components/AuditLogTable";

const ITEMS_PER_PAGE = 50;

type AuditLogFiltersState = Omit<AuditLogsQueryParams, "page"> & {
  limit: number;
};

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default function AuditLogPage() {
  const { t, language } = useTranslation();
  const [filters, setFilters] = useState<AuditLogFiltersState>({
    limit: ITEMS_PER_PAGE,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: "short" }), [language]);
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }),
    [language],
  );

  const { data: users } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => usersApi.list(),
  });

  const hasActiveFilters = useMemo(() => {
    return !!(filters.action || filters.entityType || filters.userId || filters.dateFrom || filters.dateTo);
  }, [filters]);

  const updateFilter = useCallback((key: keyof AuditLogFiltersState, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ limit: ITEMS_PER_PAGE });
  }, []);

  const queryKeyFilters = useMemo(
    () => ({
      limit: filters.limit,
      action: filters.action,
      entityType: filters.entityType,
      userId: filters.userId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters],
  );

  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/audit-logs", queryKeyFilters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      auditLogsApi.list({
        ...queryKeyFilters,
        page: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined),
  });

  const logs = useMemo<EnrichedAuditLog[]>(() => data?.pages.flatMap((page) => page.data) ?? [], [data?.pages]);
  const pagination = data?.pages[0]?.pagination;

  const exportToCsv = useCallback(async () => {
    if (exporting) return;

    const escapeCsvCell = (value: unknown) => {
      const raw = String(value ?? "");
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

    try {
      setExporting(true);

      const pageLimit = 500;
      const firstPage = await auditLogsApi.list({ ...queryKeyFilters, page: 1, limit: pageLimit });
      const totalPages = firstPage.pagination.totalPages;

      let allLogs: EnrichedAuditLog[] = [...firstPage.data];
      for (let page = 2; page <= totalPages; page++) {
        const next = await auditLogsApi.list({ ...queryKeyFilters, page, limit: pageLimit });
        allLogs = allLogs.concat(next.data);
      }

      if (allLogs.length === 0) return;

      const rows = allLogs.map((log) => [
        log.createdAt ? dateTimeFormatter.format(new Date(log.createdAt)) : "-",
        log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : t("auditLog.system"),
        log.action,
        log.entityType,
        log.entityName || `#${log.entityId}`,
      ]);

      const csvContent = [headers.map(escapeCsvCell).join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join(
        "\n",
      );

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `audit-log-${formatIsoDate(new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  }, [dateTimeFormatter, exporting, queryKeyFilters, t]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-7 w-56" />
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
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-audit-log-title">
              {t("auditLog.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("auditLog.subtitle")}</p>
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
            disabled={exporting}
            className="gap-2"
            aria-label={t("auditLog.exportCsv")}
          >
            <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
            {exporting ? t("common.loading") : t("auditLog.exportCsv")}
          </Button>
        </div>
      </div>

      {showFilters && (
        <AuditLogFilters
          filters={filters}
          users={users}
          dateFormatter={dateFormatter}
          hasActiveFilters={hasActiveFilters}
          onChangeFilter={updateFilter}
          onClearFilters={clearFilters}
        />
      )}

      {pagination && (
        <div className="mb-3 text-sm text-muted-foreground">
          {t("auditLog.showing", {
            from: logs.length ? 1 : 0,
            to: Math.min(logs.length, pagination.total),
            total: pagination.total,
          })}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <AuditLogTable
          logs={logs}
          dateTimeFormatter={dateTimeFormatter}
          emptyLabel={hasActiveFilters ? t("auditLog.noResults") : t("auditLog.empty")}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
        />
      </div>
    </div>
  );
}
