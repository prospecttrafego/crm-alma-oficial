"use client";

import { BarChart3, LineChartIcon, PieChartIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChartType } from "@/pages/reports/types";

type Props = {
  value: ChartType;
  onChange: (next: ChartType) => void;
};

export function ChartTypeToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="icon"
        className={cn(value === "bar" && "bg-accent")}
        onClick={() => onChange("bar")}
        data-testid="button-chart-bar"
      >
        <BarChart3 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(value === "line" && "bg-accent")}
        onClick={() => onChange("line")}
        data-testid="button-chart-line"
      >
        <LineChartIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(value === "pie" && "bg-accent")}
        onClick={() => onChange("pie")}
        data-testid="button-chart-pie"
      >
        <PieChartIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

