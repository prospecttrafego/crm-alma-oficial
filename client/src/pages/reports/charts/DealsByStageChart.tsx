"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyChart } from "@/pages/reports/components/EmptyChart";
import { CHART_COLORS, type ChartType, type ReportData } from "@/pages/reports/types";
import { hasNonZeroData } from "@/pages/reports/charts/utils";

type Props = {
  dealsByStage: ReportData["dealsByStage"] | undefined;
  chartType: ChartType;
  noDataLabel: string;
  dealsLabel: string;
  formatCount: (value: number) => string;
};

export function DealsByStageChart({
  dealsByStage,
  chartType,
  noDataLabel,
  dealsLabel,
  formatCount,
}: Props) {
  if (!dealsByStage?.length) {
    return <EmptyChart label={noDataLabel} />;
  }

  const data = dealsByStage.map((d) => ({
    stage: d.stage,
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
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            name={dealsLabel}
            strokeWidth={2}
          />
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" className="text-xs" tickFormatter={formatCount} />
        <YAxis dataKey="stage" type="category" width={120} className="text-xs" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" name={dealsLabel} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
