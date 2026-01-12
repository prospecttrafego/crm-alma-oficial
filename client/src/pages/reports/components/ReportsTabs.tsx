"use client";

import type { ChartType, ReportData } from "@/pages/reports/types";

import { Activity, Download, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivitySummaryChart } from "@/pages/reports/charts/ActivitySummaryChart";
import { DealsByStageChart } from "@/pages/reports/charts/DealsByStageChart";
import { DealsOverTimeChart } from "@/pages/reports/charts/DealsOverTimeChart";
import { TeamPerformanceChart } from "@/pages/reports/charts/TeamPerformanceChart";
import { WonLostChart } from "@/pages/reports/charts/WonLostChart";
import { ChartTypeToggle } from "@/pages/reports/components/ChartTypeToggle";
import { ConversionFunnelCard } from "@/pages/reports/components/ConversionFunnelCard";
import { TopPerformersCard } from "@/pages/reports/components/TopPerformersCard";

type Props = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isLoading: boolean;
  reportData: ReportData | undefined;
  chartType: ChartType;
  onChartTypeChange: (next: ChartType) => void;
  formatCount: (value: number) => string;
  formatCurrency: (value: number) => string;
  formatShortDate: (value: string | number | Date) => string;
  onExportTeam: () => void;
  onExportActivities: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ReportsTabs({
  activeTab,
  onTabChange,
  isLoading,
  reportData,
  chartType,
  onChartTypeChange,
  formatCount,
  formatCurrency,
  formatShortDate,
  onExportTeam,
  onExportActivities,
  t,
}: Props) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="overview" data-testid="tab-overview">
          {t("reports.tabs.overview")}
        </TabsTrigger>
        <TabsTrigger value="sales" data-testid="tab-sales">
          {t("reports.tabs.sales")}
        </TabsTrigger>
        <TabsTrigger value="team" data-testid="tab-team">
          {t("reports.tabs.team")}
        </TabsTrigger>
        <TabsTrigger value="activities" data-testid="tab-activities">
          {t("reports.tabs.activities")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("reports.charts.dealsOverTime")}</CardTitle>
              <CardDescription>{t("reports.charts.dealsOverTimeDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <DealsOverTimeChart
                  dealsOverTime={reportData?.dealsOverTime}
                  noDataLabel={t("reports.noData.timeline")}
                  dealsLabel={t("reports.deals")}
                  formatCount={formatCount}
                  formatShortDate={formatShortDate}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("reports.charts.activitySummary")}</CardTitle>
              <CardDescription>{t("reports.charts.activitySummaryDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ActivitySummaryChart
                  activitySummary={reportData?.activitySummary}
                  noDataLabel={t("reports.noData.activities")}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold">{t("reports.charts.dealsByStage")}</CardTitle>
                <CardDescription>{t("reports.charts.dealsByStageDesc")}</CardDescription>
              </div>
              <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <DealsByStageChart
                  dealsByStage={reportData?.dealsByStage}
                  chartType={chartType}
                  noDataLabel={t("reports.noData.deals")}
                  dealsLabel={t("reports.deals")}
                  formatCount={formatCount}
                />
              )}
            </CardContent>
          </Card>

          <TopPerformersCard
            title={t("reports.charts.topPerformers")}
            description={t("reports.charts.topPerformersDesc")}
            isLoading={isLoading}
            teamPerformance={reportData?.teamPerformance}
            noDataLabel={t("reports.noData.team")}
            dealsLabel={t("reports.deals")}
            formatCurrency={formatCurrency}
          />

          <ConversionFunnelCard
            title={t("reports.charts.conversionFunnel")}
            description={t("reports.charts.conversionFunnelDesc")}
            isLoading={isLoading}
            conversionFunnel={reportData?.conversionFunnel}
            noDataLabel={t("reports.noData.deals")}
            dealsLabel={t("reports.deals")}
            formatCurrency={formatCurrency}
          />
        </div>
      </TabsContent>

      <TabsContent value="sales" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("reports.charts.wonVsLost")}</CardTitle>
              <CardDescription>{t("reports.charts.wonVsLostDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <WonLostChart
                  wonLostByMonth={reportData?.wonLostByMonth}
                  noDataLabel={t("reports.noData.winLoss")}
                  wonLabel={t("dashboard.won")}
                  lostLabel={t("dashboard.lost")}
                  formatCount={formatCount}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold">{t("reports.charts.dealsByStage")}</CardTitle>
              <CardDescription>{t("reports.charts.pipelineDistribution")}</CardDescription>
              </div>
              <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <DealsByStageChart
                  dealsByStage={reportData?.dealsByStage}
                  chartType={chartType}
                  noDataLabel={t("reports.noData.deals")}
                  dealsLabel={t("reports.deals")}
                  formatCount={formatCount}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="team" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">{t("reports.charts.teamPerformance")}</CardTitle>
              <CardDescription>{t("reports.charts.teamPerformanceDesc")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onExportTeam} data-testid="button-export-team">
              <Download className="mr-2 h-4 w-4" />
              {t("reports.export")}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TeamPerformanceChart
                teamPerformance={reportData?.teamPerformance}
                noDataLabel={t("reports.noData.team")}
                dealsLabel={t("reports.deals")}
                wonDealsLabel={t("dashboard.stats.wonDeals")}
                formatCount={formatCount}
              />
            )}
          </CardContent>
        </Card>

        {reportData?.teamPerformance && reportData.teamPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("reports.charts.teamDetails")}</CardTitle>
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
                        {member.deals > 0 ? Math.round((member.wonDeals / member.deals) * 100) : 0}%{" "}
                        {t("dashboard.winRate").toLowerCase()}
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
              <CardTitle className="text-base font-semibold">{t("reports.charts.activitySummary")}</CardTitle>
              <CardDescription>{t("reports.charts.activitySummaryDesc")}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportActivities}
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
              <ActivitySummaryChart
                activitySummary={reportData?.activitySummary}
                noDataLabel={t("reports.noData.activities")}
              />
            )}
          </CardContent>
        </Card>

        {reportData?.activitySummary && reportData.activitySummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("reports.charts.activityBreakdown")}</CardTitle>
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
  );
}
