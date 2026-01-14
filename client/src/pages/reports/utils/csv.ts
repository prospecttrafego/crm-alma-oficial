import { format } from "date-fns";

import type { ReportData } from "@/pages/reports/types";

function escapeCsvValue(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filenamePrefix: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filenamePrefix}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
}

export function exportRowsToCsv(rows: Array<Record<string, unknown>>, filenamePrefix: string) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n");

  downloadCsv(filenamePrefix, csvContent);
}

export function exportFullReportToCsv(reportData: ReportData) {
  let csvContent = "";

  csvContent += "DEALS BY STAGE\n";
  csvContent += "Stage,Count,Value\n";
  reportData.dealsByStage.forEach((d) => {
    csvContent += `${escapeCsvValue(d.stage)},${d.count},${escapeCsvValue(d.value)}\n`;
  });

  csvContent += "\nTEAM PERFORMANCE\n";
  csvContent += "Name,Total Deals,Won Deals,Value\n";
  reportData.teamPerformance.forEach((p) => {
    csvContent += `${escapeCsvValue(p.name)},${p.deals},${p.wonDeals},${escapeCsvValue(p.value)}\n`;
  });

  csvContent += "\nACTIVITY SUMMARY\n";
  csvContent += "Type,Count\n";
  reportData.activitySummary.forEach((a) => {
    csvContent += `${escapeCsvValue(a.type)},${a.count}\n`;
  });

  csvContent += "\nWON/LOST BY MONTH\n";
  csvContent += "Month,Won,Lost,Won Value,Lost Value\n";
  reportData.wonLostByMonth.forEach((w) => {
    csvContent += `${escapeCsvValue(w.month)},${w.won},${w.lost},${escapeCsvValue(w.wonValue)},${escapeCsvValue(w.lostValue)}\n`;
  });

  downloadCsv("full_report", csvContent);
}

