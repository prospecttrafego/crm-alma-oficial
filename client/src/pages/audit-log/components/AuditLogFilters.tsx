import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { useTranslation } from "@/contexts/LanguageContext";
import { auditLogActions, auditLogEntityTypes, type AuditLogAction, type AuditLogEntityType } from "@shared/schema";
import type { SafeUser } from "@shared/types";

import type { AuditLogsQueryParams } from "@/lib/api/auditLogs";

type Filters = Omit<AuditLogsQueryParams, "page"> & { limit: number };

type Props = {
  filters: Filters;
  users: SafeUser[] | undefined;
  dateFormatter: Intl.DateTimeFormat;
  hasActiveFilters: boolean;
  onChangeFilter: (key: keyof Filters, value: string | number | undefined) => void;
  onClearFilters: () => void;
};

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function AuditLogFilters({
  filters,
  users,
  dateFormatter,
  hasActiveFilters,
  onChangeFilter,
  onClearFilters,
}: Props) {
  const { t } = useTranslation();
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t("auditLog.filters.action")}</label>
        <Select value={filters.action || "all"} onValueChange={(value) => onChangeFilter("action", value === "all" ? undefined : value)}>
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

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t("auditLog.filters.entityType")}</label>
        <Select
          value={filters.entityType || "all"}
          onValueChange={(value) => onChangeFilter("entityType", value === "all" ? undefined : value)}
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

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t("auditLog.filters.user")}</label>
        <Select value={filters.userId || "all"} onValueChange={(value) => onChangeFilter("userId", value === "all" ? undefined : value)}>
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

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t("auditLog.filters.dateFrom")}</label>
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? dateFormatter.format(new Date(filters.dateFrom)) : t("auditLog.filters.selectDate")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <LazyCalendar
              mode="single"
              selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              onSelect={(date) => {
                onChangeFilter("dateFrom", date ? formatIsoDate(date) : undefined);
                setDateFromOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">{t("auditLog.filters.dateTo")}</label>
        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? dateFormatter.format(new Date(filters.dateTo)) : t("auditLog.filters.selectDate")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <LazyCalendar
              mode="single"
              selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
              onSelect={(date) => {
                onChangeFilter("dateTo", date ? formatIsoDate(date) : undefined);
                setDateToOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-transparent">Clear</label>
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
            <X className="h-4 w-4" />
            {t("auditLog.filters.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}
