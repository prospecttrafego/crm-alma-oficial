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
  wonLostByMonth: ReportData["wonLostByMonth"] | undefined;
  noDataLabel: string;
  wonLabel: string;
  lostLabel: string;
  formatCount: (value: number) => string;
};

export function WonLostChart({ wonLostByMonth, noDataLabel, wonLabel, lostLabel, formatCount }: Props) {
  if (!wonLostByMonth?.length) {
    return <EmptyChart label={noDataLabel} />;
  }

  const data = wonLostByMonth.map((d) => ({
    month: d.month,
    won: d.won,
    lost: d.lost,
  }));

  if (!hasNonZeroData(data, ["won", "lost"])) {
    return <EmptyChart label={noDataLabel} />;
  }

  const chartConfig = {
    won: {
      label: wonLabel,
      color: "hsl(var(--chart-1))",
    },
    lost: {
      label: lostLabel,
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
        <Bar dataKey="won" fill="var(--color-won)" name={wonLabel} radius={[4, 4, 0, 0]} />
        <Bar dataKey="lost" fill="var(--color-lost)" name={lostLabel} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

