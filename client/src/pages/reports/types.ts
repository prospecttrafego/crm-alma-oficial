export interface ReportData {
  dealsByStage: { stage: string; count: number; value: string }[];
  dealsOverTime: { date: string; count: number; value: string }[];
  conversionFunnel: { stage: string; deals: number; value: string; order: number }[];
  teamPerformance: { userId: string; name: string; deals: number; value: string; wonDeals: number }[];
  activitySummary: { type: string; count: number }[];
  wonLostByMonth: { month: string; won: number; lost: number; wonValue: string; lostValue: string }[];
}

export type ChartType = "bar" | "line" | "pie";

export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

