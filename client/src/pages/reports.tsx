import { useState } from "react";
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
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CalendarIcon,
  Download,
  FileSpreadsheet,
  FileText,
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
  "hsl(var(--primary))",
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
  const { t } = useTranslation();
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

  const renderDealsByStageChart = () => {
    if (!reportData?.dealsByStage.length) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("reports.noData.deals")}</div>;
    }

    const data = reportData.dealsByStage.map(d => ({
      name: d.stage,
      count: d.count,
      value: Number(d.value),
    }));

    if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, "Deals"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" name="Deals" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="hsl(var(--primary))" name="Deals" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderDealsOverTimeChart = () => {
    if (!reportData?.dealsOverTime.length) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("reports.noData.timeline")}</div>;
    }

    const data = reportData.dealsOverTime.map(d => ({
      date: format(new Date(d.date), "MMM dd"),
      count: d.count,
      value: Number(d.value),
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" name="New Deals" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderWonLostChart = () => {
    if (!reportData?.wonLostByMonth.length) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("reports.noData.winLoss")}</div>;
    }

    const data = reportData.wonLostByMonth.map(d => ({
      month: d.month,
      won: d.won,
      lost: d.lost,
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip />
          <Legend />
          <Bar dataKey="won" fill="hsl(142.1 76.2% 36.3%)" name="Won" radius={[4, 4, 0, 0]} />
          <Bar dataKey="lost" fill="hsl(0 84.2% 60.2%)" name="Lost" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTeamPerformanceChart = () => {
    if (!reportData?.teamPerformance.length) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("reports.noData.team")}</div>;
    }

    const data = reportData.teamPerformance.map(p => ({
      name: p.name,
      deals: p.deals,
      value: Number(p.value) / 1000,
      wonDeals: p.wonDeals,
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" className="text-xs" />
          <YAxis dataKey="name" type="category" width={100} className="text-xs" />
          <Tooltip />
          <Legend />
          <Bar dataKey="deals" fill="hsl(var(--primary))" name="Total Deals" radius={[0, 4, 4, 0]} />
          <Bar dataKey="wonDeals" fill="hsl(142.1 76.2% 36.3%)" name="Won Deals" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderActivitySummaryChart = () => {
    if (!reportData?.activitySummary.length) {
      return <div className="flex h-64 items-center justify-center text-muted-foreground">{t("reports.noData.activities")}</div>;
    }

    const data = reportData.activitySummary.map(a => ({
      name: a.type.charAt(0).toUpperCase() + a.type.slice(1),
      count: a.count,
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const totalDeals = reportData?.dealsByStage.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalValue = reportData?.dealsByStage.reduce((sum, d) => sum + Number(d.value), 0) || 0;
  const wonDeals = reportData?.wonLostByMonth.reduce((sum, d) => sum + d.won, 0) || 0;
  const lostDeals = reportData?.wonLostByMonth.reduce((sum, d) => sum + d.lost, 0) || 0;
  const winRate = wonDeals + lostDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 overflow-auto p-6">
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
              <div className="text-2xl font-bold" data-testid="text-total-deals">{totalDeals}</div>
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
                R$ {totalValue.toLocaleString("pt-BR")}
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
                {reportData?.activitySummary.reduce((sum, a) => sum + a.count, 0) || 0}
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
                        <p className="font-medium">R$ {Number(member.value).toLocaleString("pt-BR")}</p>
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
