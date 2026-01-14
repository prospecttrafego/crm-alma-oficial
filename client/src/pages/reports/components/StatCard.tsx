"use client";

import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  valueTestId: string;
  isLoading: boolean;
  valueSkeletonClassName?: string;
  description?: ReactNode;
  badge?: ReactNode;
};

export function StatCard({
  icon,
  label,
  value,
  valueTestId,
  isLoading,
  valueSkeletonClassName = "h-8 w-16",
  description,
  badge,
}: Props) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{label}</p>
              {isLoading ? (
                <Skeleton className={valueSkeletonClassName} />
              ) : (
                <div className="text-2xl font-semibold" data-testid={valueTestId}>
                  {value}
                </div>
              )}
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
