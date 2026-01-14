"use client";

import type { Locale } from "date-fns";

import { format } from "date-fns";
import { CalendarIcon, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DateRange = { from: Date; to: Date };

type PresetRange = {
  label: string;
  getValue: () => DateRange;
};

type Props = {
  title: string;
  subtitle: string;
  presetRanges: PresetRange[];
  quickSelectPlaceholder: string;
  exportCsvLabel: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  dateFnsLocale: Locale;
  onExportCsv: () => void;
};

export function ReportsHeader({
  title,
  subtitle,
  presetRanges,
  quickSelectPlaceholder,
  exportCsvLabel,
  dateRange,
  onDateRangeChange,
  dateFnsLocale,
  onExportCsv,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-reports-title">
          {title}
        </h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onValueChange={(value) => {
            const preset = presetRanges.find((p) => p.label === value);
            if (preset) onDateRangeChange(preset.getValue());
          }}
        >
          <SelectTrigger className="w-[150px]" data-testid="select-date-preset">
            <SelectValue placeholder={quickSelectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {presetRanges.map((preset) => (
              <SelectItem key={preset.label} value={preset.label}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="button-date-range">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dateRange.from, "MMM dd", { locale: dateFnsLocale })} -{" "}
              {format(dateRange.to, "MMM dd, yyyy", { locale: dateFnsLocale })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onDateRangeChange({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Button onClick={onExportCsv} data-testid="button-export-csv">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {exportCsvLabel}
        </Button>
      </div>
    </div>
  );
}
