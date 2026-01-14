"use client";

import { useMemo } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportData } from "@/pages/reports/types";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

type Props = {
  title: string;
  description: string;
  isLoading: boolean;
  teamPerformance: ReportData["teamPerformance"] | undefined;
  noDataLabel: string;
  dealsLabel: string;
  formatCurrency: (value: number) => string;
};

export function TopPerformersCard({
  title,
  description,
  isLoading,
  teamPerformance,
  noDataLabel,
  dealsLabel,
  formatCurrency,
}: Props) {
  const top = useMemo(() => {
    if (!teamPerformance?.length) return [];
    return [...teamPerformance]
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 4);
  }, [teamPerformance]);

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
            <Skeleton className="h-10 w-full" />
          </div>
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">{noDataLabel}</p>
        ) : (
          <div className="space-y-3">
            {top.map((member, index) => (
              <div key={member.userId} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-4 text-sm text-muted-foreground">{index + 1}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.deals} {dealsLabel}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm font-medium">{formatCurrency(Number(member.value))}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
