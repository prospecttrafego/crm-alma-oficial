export function hasNonZeroData(data: Array<Record<string, unknown>>, keys: string[]) {
  return data.length > 0 && data.some((item) => keys.some((key) => Number(item[key] ?? 0) > 0));
}

