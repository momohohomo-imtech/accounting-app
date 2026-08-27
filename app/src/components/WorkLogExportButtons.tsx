"use client";

import type { MonthCell } from "@/lib/calendar";
import { downloadWorkLogCalendarXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

type LogEntry = { log_date: string; title: string; color: string | null; site_id: string | null };

export function WorkLogExportButtons({
  year,
  month,
  weeks,
  logs,
  sites = [],
}: {
  year: number;
  month: number;
  weeks: MonthCell[][];
  logs: LogEntry[];
  sites?: { id: string; name: string; color: string | null }[];
}) {
  async function handleExport() {
    const byDate = new Map<string, LogEntry[]>();
    for (const l of logs) {
      const arr = byDate.get(l.log_date) ?? [];
      arr.push(l);
      byDate.set(l.log_date, arr);
    }
    await downloadWorkLogCalendarXlsx(`${year}년_${month}월_작업일지.xlsx`, year, month, weeks, byDate, sites);
  }

  return (
    <div className="flex gap-2 print:hidden">
      <PrintButton />
      <Button variant="secondary" size="sm" onClick={handleExport}>
        엑셀 다운로드
      </Button>
    </div>
  );
}
