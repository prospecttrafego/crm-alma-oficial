"use client";

import { Activity, DollarSign, TrendingUp } from "lucide-react";

import { StatCard } from "@/pages/reports/components/StatCard";

type Props = {
  isLoading: boolean;
  totalDealsLabel: string;
  totalDealsValue: string;
  totalValueLabel: string;
  totalValueValue: string;
  winRateLabel: string;
  winRateValue: string;
  winRateDescription: string;
  activitiesLabel: string;
  activitiesValue: string;
};

export function ReportsTopStats({
  isLoading,
  totalDealsLabel,
  totalDealsValue,
  totalValueLabel,
  totalValueValue,
  winRateLabel,
  winRateValue,
  winRateDescription,
  activitiesLabel,
  activitiesValue,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<TrendingUp className="h-5 w-5" strokeWidth={1.75} />}
        label={totalDealsLabel}
        value={totalDealsValue}
        valueTestId="text-total-deals"
        isLoading={isLoading}
      />

      <StatCard
        icon={<DollarSign className="h-5 w-5" strokeWidth={1.75} />}
        label={totalValueLabel}
        value={totalValueValue}
        valueTestId="text-total-value"
        isLoading={isLoading}
        valueSkeletonClassName="h-8 w-24"
      />

      <StatCard
        icon={<TrendingUp className="h-5 w-5" strokeWidth={1.75} />}
        label={winRateLabel}
        value={winRateValue}
        valueTestId="text-win-rate"
        isLoading={isLoading}
        description={winRateDescription}
      />

      <StatCard
        icon={<Activity className="h-5 w-5" strokeWidth={1.75} />}
        label={activitiesLabel}
        value={activitiesValue}
        valueTestId="text-total-activities"
        isLoading={isLoading}
      />
    </div>
  );
}
