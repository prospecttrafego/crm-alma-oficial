import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { reportsApi } from "@/lib/api/reports";
import { ReportsHeader } from "@/pages/reports/components/ReportsHeader";
import { ReportsTabs } from "@/pages/reports/components/ReportsTabs";
import { ReportsTopStats } from "@/pages/reports/components/ReportsTopStats";
import type { ChartType, ReportData } from "@/pages/reports/types";
import { exportFullReportToCsv, exportRowsToCsv } from "@/pages/reports/utils/csv";

export default function ReportsPage() {
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const dateFnsLocale = language === "pt-BR" ? ptBR : enUS;
  const presetRanges = useMemo(() => ([
    { label: t("reports.datePresets.last7Days"), getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: t("reports.datePresets.last30Days"), getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: t("reports.datePresets.thisMonth"), getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: t("reports.datePresets.lastMonth"), getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: t("reports.datePresets.last90Days"), getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  ]), [t]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
    [locale]
  );
  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "2-digit" }),
    [locale]
  );
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      return reportsApi.get({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
    },
  });

  const formatCount = (value: number) => numberFormatter.format(value);
  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatShortDate = (value: string | number | Date) => shortDateFormatter.format(new Date(value));

  const totalDeals = reportData?.dealsByStage.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalValue = reportData?.dealsByStage.reduce((sum, d) => sum + Number(d.value), 0) || 0;
  const wonDeals = reportData?.wonLostByMonth.reduce((sum, d) => sum + d.won, 0) || 0;
  const lostDeals = reportData?.wonLostByMonth.reduce((sum, d) => sum + d.lost, 0) || 0;
  const winRate = wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;
  const totalActivities = reportData?.activitySummary.reduce((sum, a) => sum + a.count, 0) || 0;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <ReportsHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        presetRanges={presetRanges}
        quickSelectPlaceholder={t("reports.quickSelect")}
        exportCsvLabel={t("reports.exportCsv")}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        dateFnsLocale={dateFnsLocale}
        onExportCsv={() => (reportData ? exportFullReportToCsv(reportData) : undefined)}
      />

      <ReportsTopStats
        isLoading={isLoading}
        totalDealsLabel={t("dashboard.stats.totalDeals")}
        totalDealsValue={formatCount(totalDeals)}
        totalValueLabel={t("dashboard.stats.totalValue")}
        totalValueValue={formatCurrency(totalValue)}
        winRateLabel={t("dashboard.winRate")}
        winRateValue={`${winRate}%`}
        winRateDescription={`${wonDeals} ${t("dashboard.won")} / ${lostDeals} ${t("dashboard.lost")}`}
        activitiesLabel={t("nav.activities")}
        activitiesValue={formatCount(totalActivities)}
      />

      <ReportsTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isLoading={isLoading}
        reportData={reportData}
        chartType={chartType}
        onChartTypeChange={setChartType}
        formatCount={formatCount}
        formatCurrency={formatCurrency}
        formatShortDate={formatShortDate}
        onExportTeam={() =>
          reportData?.teamPerformance ? exportRowsToCsv(reportData.teamPerformance, "team_performance") : undefined
        }
        onExportActivities={() =>
          reportData?.activitySummary ? exportRowsToCsv(reportData.activitySummary, "activities") : undefined
        }
        t={t}
      />
    </div>
  );
}
