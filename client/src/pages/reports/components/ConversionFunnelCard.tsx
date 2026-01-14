"use client";

import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportData } from "@/pages/reports/types";

type Props = {
  title: string;
  description: string;
  isLoading: boolean;
  conversionFunnel: ReportData["conversionFunnel"] | undefined;
  noDataLabel: string;
  dealsLabel: string;
  formatCurrency: (value: number) => string;
};

export function ConversionFunnelCard({
  title,
  description,
  isLoading,
  conversionFunnel,
  noDataLabel,
  dealsLabel,
  formatCurrency,
}: Props) {
  const stages = useMemo(() => {
    if (!conversionFunnel?.length) return [];
    return [...conversionFunnel].sort((a, b) => a.order - b.order);
  }, [conversionFunnel]);

  const maxDeals = stages.reduce((max, stage) => Math.max(max, stage.deals), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{noDataLabel}</p>
        ) : (
          stages.map((stage) => {
            const progress = maxDeals > 0 ? Math.round((stage.deals / maxDeals) * 100) : 0;
            return (
              <div key={stage.stage} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{stage.stage}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.deals} {dealsLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm font-medium">{formatCurrency(Number(stage.value))}</div>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
