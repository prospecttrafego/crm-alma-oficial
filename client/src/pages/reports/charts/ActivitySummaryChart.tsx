"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { hasNonZeroData } from "@/pages/reports/charts/utils";
import { EmptyChart } from "@/pages/reports/components/EmptyChart";
import { CHART_COLORS, type ReportData } from "@/pages/reports/types";

type Props = {
  activitySummary: ReportData["activitySummary"] | undefined;
  noDataLabel: string;
};

export function ActivitySummaryChart({ activitySummary, noDataLabel }: Props) {
  if (!activitySummary?.length) {
    return <EmptyChart label={noDataLabel} />;
  }

  const data = activitySummary.map((a) => ({
    name: a.type.charAt(0).toUpperCase() + a.type.slice(1),
    count: a.count,
  }));

  if (!hasNonZeroData(data, ["count"])) {
    return <EmptyChart label={noDataLabel} />;
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
    <ChartContainer config={pieConfig} className="min-h-[260px] w-full aspect-square">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
        <Pie
          data={pieData}
          dataKey="count"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={100}
          paddingAngle={2}
          cornerRadius={6}
          stroke="hsl(var(--background))"
          strokeWidth={2}
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
