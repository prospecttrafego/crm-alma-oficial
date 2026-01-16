type RelativeTimeUnit = Intl.RelativeTimeFormatUnit;

function toValidDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatRelativeTimeFromNow(
  value: string | number | Date,
  {
    locale,
    now = new Date(),
    justNow,
  }: {
    locale: string;
    now?: Date;
    justNow?: string;
  },
): string {
  const date = toValidDate(value);
  if (!date) return "-";

  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = diffMs / 1000;
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) {
    if (justNow) return justNow;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return formatter.format(0, "second");
  }

  const thresholds: Array<{ unit: RelativeTimeUnit; seconds: number }> = [
    { unit: "year", seconds: 60 * 60 * 24 * 365 },
    { unit: "month", seconds: 60 * 60 * 24 * 30 },
    { unit: "week", seconds: 60 * 60 * 24 * 7 },
    { unit: "day", seconds: 60 * 60 * 24 },
    { unit: "hour", seconds: 60 * 60 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

  const selected = thresholds.find((t) => absSeconds >= t.seconds) ?? thresholds[thresholds.length - 1];
  const valueInUnit = Math.round(diffSeconds / selected.seconds);

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return formatter.format(valueInUnit, selected.unit);
}

