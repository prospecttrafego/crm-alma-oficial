"use client";

import { BarChart3 } from "lucide-react";

type Props = {
  label: string;
};

export function EmptyChart({ label }: Props) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
      <BarChart3 className="h-8 w-8 opacity-50" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

