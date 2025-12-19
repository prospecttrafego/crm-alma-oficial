import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  CalendarIcon,
  Download,
  FileSpreadsheet,
  BarChart3,
  LineChartIcon,
  PieChartIcon,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface ReportData {
  dealsByStage: { stage: string; count: number; value: string }[];
  dealsOverTime: { date: string; count: number; value: string }[];
  conversionFunnel: { stage: string; deals: number; value: string; order: number }[];
  teamPerformance: { userId: string; name: string; deals: number; value: string; wonDeals: number }[];
  activitySummary: { type: string; count: number }[];
  wonLostByMonth: { month: string; won: number; lost: number; wonValue: string; lostValue: string }[];
}

type ChartType = "bar" | "line" | "pie";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PRESET_RANGES = [
  { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "This month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last month", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "Last 90 days", getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
];

export default function ReportsPage() {
  const { t, language } = useTranslation();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
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
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
  });

  const escapeCSVValue = (value: unknown): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = (data: object[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => escapeCSVValue((row as Record<string, unknown>)[header])).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const exportAllToCSV = () => {
    if (!reportData) return;
    
    let csvContent = "";
    
    csvContent += "DEALS BY STAGE\n";
    csvContent += "Stage,Count,Value\n";
    reportData.dealsByStage.forEach(d => {
      csvContent += `${escapeCSVValue(d.stage)},${d.count},${escapeCSVValue(d.value)}\n`;
    });
    
    csvContent += "\nTEAM PERFORMANCE\n";
    csvContent += "Name,Total Deals,Won Deals,Value\n";
    reportData.teamPerformance.forEach(p => {
      csvContent += `${escapeCSVValue(p.name)},${p.deals},${p.wonDeals},${escapeCSVValue(p.value)}\n`;
    });
    
    csvContent += "\nACTIVITY SUMMARY\n";
    csvContent += "Type,Count\n";
    reportData.activitySummary.forEach(a => {
      csvContent += `${escapeCSVValue(a.type)},${a.count}\n`;
    });
    
    csvContent += "\nWON/LOST BY MONTH\n";
    csvContent += "Month,Won,Lost,Won Value,Lost Value\n";
    reportData.wonLostByMonth.forEach(w => {
      csvContent += `${escapeCSVValue(w.month)},${w.won},${w.lost},${escapeCSVValue(w.wonValue)},${escapeCSVValue(w.lostValue)}\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `full_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const formatCount = (value: number) => numberFormatter.format(value);
  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatShortDate = (value: string | number | Date) => shortDateFormatter.format(new Date(value));

  const hasNonZeroData = (data: Array<Record<string, unknown>>, keys: string[]) =>
    data.length > 0 && data.some((item) => keys.some((key) => Number(item[key] ?? 0) > 0));

  const EmptyChart = ({ label }: { label: string }) => (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
      <BarChart3 className="h-8 w-8 opacity-50" />
      <p className="text-sm">{label}</p>
    </div>
  );

  const renderDealsByStageChart = () => {
    if (!reportData?.dealsByStage.length) {
      return <EmptyChart label={t("reports.noData.deals")} />;
    }

    const data = reportData.dealsByStage.map(d => ({
      stage: d.stage,
      count: d.count,
      value: Number(d.value),
    }));

    if (!hasNonZeroData(data, ["count"])) {
      return <EmptyChart label={t("reports.noData.deals")} />;
    }

    const chartConfig = {
      count: {
        label: t("reports.deals"),
        color: "hsl(var(--chart-1))",
      },
    } satisfies ChartConfig;

    if (chartType === "pie") {
      const pieData = data.map((item, index) => ({
        ...item,
        key: `stage-${index}`,
      }));
      const pieConfig = pieData.reduce((acc, item, index) => {
        acc[item.key] = {
          label: item.stage,
          color: CHART_COLORS[index % CHART_COLORS.length],
        };
        return acc;
      }, {} as ChartConfig);

      return (
        <ChartContainer config={pieConfig} className="min-h-[260px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
            <Pie
              data={pieData}
              dataKey="count"
              nameKey="stage"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {pieData.map((item) => (
                <Cell key={item.key} fill={`var(--color-${item.key})`} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} />
          </PieChart>
        </ChartContainer>
      );
    }

    if (chartType === "line") {
      return (
        <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="stage" className="text-xs" />
            <YAxis className="text-xs" tickFormatter={formatCount} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--color-count)"
              name={t("reports.deals")}
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      );
    }

    return (
      <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="stage" className="text-xs" />
          <YAxis className="text-xs" tickFormatter={formatCount} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="count" fill="var(--color-count)" name={t("reports.deals")} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    );
  };

  const renderDealsOverTimeChart = () => {
    if (!reportData?.dealsOverTime.length) {
      return <EmptyChart label={t("reports.noData.timeline")} />;
    }

    const data = reportData.dealsOverTime.map(d => ({
      date: d.date,
      count: d.count,
      value: Number(d.value),
    }));

    if (!hasNonZeroData(data, ["count"])) {
      return <EmptyChart label={t("reports.noData.timeline")} />;
    }

    const chartConfig = {
      count: {
        label: t("reports.deals"),
        color: "hsl(var(--chart-1))",
      },
    } satisfies ChartConfig;

    return (
      <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tickFormatter={(value) => formatShortDate(value)}
          />
          <YAxis className="text-xs" tickFormatter={formatCount} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) => formatShortDate(label as string)}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            name={t("reports.deals")}
            strokeWidth={2}
          />
        </LineChart>
      </ChartContainer>
    );
  };

  const renderWonLostChart = () => {
    if (!reportData?.wonLostByMonth.length) {
      return <EmptyChart label={t("reports.noData.winLoss")} />;
    }

    const data = reportData.wonLostByMonth.map(d => ({
      month: d.month,
      won: d.won,
      lost: d.lost,
    }));

    if (!hasNonZeroData(data, ["won", "lost"])) {
      return <EmptyChart label={t("reports.noData.winLoss")} />;
    }

    const chartConfig = {
      won: {
        label: t("dashboard.won"),
        color: "hsl(var(--chart-1))",
      },
      lost: {
        label: t("dashboard.lost"),
        color: "hsl(var(--chart-2))",
      },
    } satisfies ChartConfig;

    return (
      <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" tickFormatter={formatCount} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="won" fill="var(--color-won)" name={t("dashboard.won")} radius={[4, 4, 0, 0]} />
          <Bar dataKey="lost" fill="var(--color-lost)" name={t("dashboard.lost")} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    );
  };

  const renderTeamPerformanceChart = () => {
    if (!reportData?.teamPerformance.length) {
      return <EmptyChart label={t("reports.noData.team")} />;
    }

    const data = reportData.teamPerformance.map(p => ({
      name: p.name,
      deals: p.deals,
      value: Number(p.value) / 1000,
      wonDeals: p.wonDeals,
    }));

    if (!hasNonZeroData(data, ["deals", "wonDeals"])) {
      return <EmptyChart label={t("reports.noData.team")} />;
    }

    const chartConfig = {
      deals: {
        label: t("reports.deals"),
        color: "hsl(var(--chart-1))",
      },
      wonDeals: {
        label: t("dashboard.stats.wonDeals"),
        color: "hsl(var(--chart-2))",
      },
    } satisfies ChartConfig;

    return (
      <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" className="text-xs" tickFormatter={formatCount} />
          <YAxis dataKey="name" type="category" width={120} className="text-xs" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="deals" fill="var(--color-deals)" name={t("reports.deals")} radius={[0, 4, 4, 0]} />
          <Bar dataKey="wonDeals" fill="var(--color-wonDeals)" name={t("dashboard.stats.wonDeals")} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    );
  };

  const renderActivitySummaryChart = () => {
    if (!reportData?.activitySummary.length) {
      return <EmptyChart label={t("reports.noData.activities")} />;
    }

    const data = reportData.activitySummary.map(a => ({
      name: a.type.charAt(0).toUpperCase() + a.type.slice(1),
      count: a.count,
    }));

    if (!hasNonZeroData(data, ["count"])) {
      return <EmptyChart label={t("reports.noData.activities")} />;
    }

    const pieData = data.map((item, index) => ({
      ...item,
      key: `activity-${index}`,
    }));
    const pieConfig = pieData.reduce((acc, item, index) => {
      acc[item.key] = {
        label: item.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
      return acc;
    }, {} as ChartConfig);

    return (
      <ChartContainer config={pieConfig} className="min-h-[260px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
          <Pie
            data={pieData}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {pieData.map((item) => (
              <Cell key={item.key} fill={`var(--color-${item.key})`} />
            ))}
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="key" />} />
        </PieChart>
      </ChartContainer>
    );
  };

  const totalDeals = reportData?.dealsByStage.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalValue = reportData?.dealsByStage.reduce((sum, d) => sum + Number(d.value), 0) || 0;
  const wonDeals = reportData?.wonLostByMonth.reduce((sum, d) => sum + d.won, 0) || 0;
  const lostDeals = reportData?.wonLostByMonth.reduce((sum, d) => sum + d.lost, 0) || 0;
  const winRate = wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reports-title">{t("reports.title")}</h1>
          <p className="text-muted-foreground">{t("reports.subtitle")}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value=""
            onValueChange={(value) => {
              const preset = PRESET_RANGES.find(p => p.label === value);
              if (preset) {
                setDateRange(preset.getValue());
              }
            }}
          >
            <SelectTrigger className="w-[150px]" data-testid="select-date-preset">
              <SelectValue placeholder={t("reports.quickSelect")} />
            </SelectTrigger>
            <SelectContent>
              {PRESET_RANGES.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" data-testid="button-date-range">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className={cn(chartType === "bar" && "bg-accent")}
              onClick={() => setChartType("bar")}
              data-testid="button-chart-bar"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(chartType === "line" && "bg-accent")}
              onClick={() => setChartType("line")}
              data-testid="button-chart-line"
            >
              <LineChartIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(chartType === "pie" && "bg-accent")}
              onClick={() => setChartType("pie")}
              data-testid="button-chart-pie"
            >
              <PieChartIcon className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" onClick={exportAllToCSV} data-testid="button-export-csv">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t("reports.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.stats.totalDeals")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-deals">{formatCount(totalDeals)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.stats.totalValue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-value">
                {formatCurrency(totalValue)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.winRate")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-win-rate">{winRate}%</div>
                <p className="text-xs text-muted-foreground">{wonDeals} {t("dashboard.won")} / {lostDeals} {t("dashboard.lost")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("nav.activities")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-activities">
                {formatCount(reportData?.activitySummary.reduce((sum, a) => sum + a.count, 0) || 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">{t("reports.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">{t("reports.tabs.sales")}</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">{t("reports.tabs.team")}</TabsTrigger>
          <TabsTrigger value="activities" data-testid="tab-activities">{t("reports.tabs.activities")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.charts.dealsByStage")}</CardTitle>
                <CardDescription>{t("reports.charts.dealsByStageDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  renderDealsByStageChart()
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("reports.charts.dealsOverTime")}</CardTitle>
                <CardDescription>{t("reports.charts.dealsOverTimeDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  renderDealsOverTimeChart()
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.charts.wonVsLost")}</CardTitle>
                <CardDescription>{t("reports.charts.wonVsLostDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  renderWonLostChart()
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("reports.charts.dealsByStage")}</CardTitle>
                <CardDescription>{t("reports.charts.pipelineDistribution")}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  renderDealsByStageChart()
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>{t("reports.charts.teamPerformance")}</CardTitle>
                <CardDescription>{t("reports.charts.teamPerformanceDesc")}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reportData?.teamPerformance && exportToCSV(reportData.teamPerformance, "team_performance")}
                data-testid="button-export-team"
              >
                <Download className="mr-2 h-4 w-4" />
                {t("reports.export")}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                renderTeamPerformanceChart()
              )}
            </CardContent>
          </Card>

          {reportData?.teamPerformance && reportData.teamPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.charts.teamDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.teamPerformance.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between rounded-md border p-3"
                      data-testid={`row-team-${member.userId}`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.deals} {t("reports.deals")} | {member.wonDeals} {t("dashboard.won")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(Number(member.value))}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.deals > 0 ? Math.round((member.wonDeals / member.deals) * 100) : 0}% {t("dashboard.winRate").toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>{t("reports.charts.activitySummary")}</CardTitle>
                <CardDescription>{t("reports.charts.activitySummaryDesc")}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reportData?.activitySummary && exportToCSV(reportData.activitySummary, "activities")}
                data-testid="button-export-activities"
              >
                <Download className="mr-2 h-4 w-4" />
                {t("reports.export")}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                renderActivitySummaryChart()
              )}
            </CardContent>
          </Card>

          {reportData?.activitySummary && reportData.activitySummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.charts.activityBreakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {reportData.activitySummary.map((activity) => (
                    <div
                      key={activity.type}
                      className="flex items-center gap-3 rounded-md border p-3"
                      data-testid={`card-activity-type-${activity.type}`}
                    >
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium capitalize">{activity.type}</p>
                        <p className="text-2xl font-bold">{activity.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
