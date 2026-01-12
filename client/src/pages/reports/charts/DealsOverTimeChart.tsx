"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { hasNonZeroData } from "@/pages/reports/charts/utils";
import { EmptyChart } from "@/pages/reports/components/EmptyChart";
import type { ReportData } from "@/pages/reports/types";

type Props = {
  dealsOverTime: ReportData["dealsOverTime"] | undefined;
  noDataLabel: string;
  dealsLabel: string;
  formatCount: (value: number) => string;
  formatShortDate: (value: string | number | Date) => string;
};

export function DealsOverTimeChart({
  dealsOverTime,
  noDataLabel,
  dealsLabel,
  formatCount,
  formatShortDate,
}: Props) {
  const gradientId = useId().replace(/:/g, "");

  if (!dealsOverTime?.length) {
    return <EmptyChart label={noDataLabel} />;
  }

  const data = dealsOverTime.map((d) => ({
    date: d.date,
    count: d.count,
    value: Number(d.value),
  }));

  if (!hasNonZeroData(data, ["count"])) {
    return <EmptyChart label={noDataLabel} />;
  }

  const chartConfig = {
    count: {
      label: dealsLabel,
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" tickFormatter={(value) => formatShortDate(value)} />
        <YAxis className="text-xs" tickFormatter={formatCount} />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(label) => formatShortDate(label as string)} />
          }
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--color-count)"
          fill={`url(#fill-${gradientId})`}
          name={dealsLabel}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
