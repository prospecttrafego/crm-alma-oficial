"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import type { ReportData } from "@/pages/reports/types";

type Props = {
  teamPerformance: ReportData["teamPerformance"] | undefined;
  noDataLabel: string;
  dealsLabel: string;
  wonDealsLabel: string;
  formatCount: (value: number) => string;
};

export function TeamPerformanceChart({
  teamPerformance,
  noDataLabel,
  dealsLabel,
  wonDealsLabel,
  formatCount,
}: Props) {
  if (!teamPerformance?.length) {
    return <EmptyChart label={noDataLabel} />;
  }

  const data = teamPerformance.map((p) => ({
    name: p.name,
    deals: p.deals,
    value: Number(p.value) / 1000,
    wonDeals: p.wonDeals,
  }));

  if (!hasNonZeroData(data, ["deals", "wonDeals"])) {
    return <EmptyChart label={noDataLabel} />;
  }

  const chartConfig = {
    deals: {
      label: dealsLabel,
      color: "hsl(var(--chart-1))",
    },
    wonDeals: {
      label: wonDealsLabel,
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
        <Bar dataKey="deals" fill="var(--color-deals)" name={dealsLabel} radius={[0, 4, 4, 0]} />
        <Bar dataKey="wonDeals" fill="var(--color-wonDeals)" name={wonDealsLabel} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

