"use client";

import { lazy, Suspense } from "react";
import type { CalendarProps } from "@/components/ui/calendar";

import { Skeleton } from "@/components/ui/skeleton";

const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((module) => ({ default: module.Calendar })),
);

export function LazyCalendar(props: CalendarProps) {
  return (
    <Suspense fallback={<Skeleton className="h-[300px] w-[320px]" />}>
      <Calendar {...props} />
    </Suspense>
  );
}

