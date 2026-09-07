"use client";

import { downloadDailyWorkerUsageStatementXlsx } from "@/lib/xlsxExport";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";
import { buildStatementDisplayItems, MONTHLY_DAY_LIMIT, type StatementRow } from "@/components/DailyWorkerUsageStatementTable";

export function DailyWorkerUsageStatementExportButtons({
  rows,
  periodLabel,
}: {
  rows: StatementRow[];
  periodLabel: string;
}) {
  async function handleExport() {
    const items = buildStatementDisplayItems(rows);
    const total = rows.reduce((s, r) => s + (r.daily_wage ?? 0), 0);

    const exportItems = items.map((item) => {
      if (item.kind !== "entry") return item;
      const r = item.row;
      return {
        kind: "entry" as const,
        use_date: r.use_date,
        name: r.name,
        monthlyCount: item.monthlyCount,
        residentId: r.resident_id_masked ?? "-",
        phone: r.phone ?? "-",
        dailyWage: r.daily_wage,
        note: r.note ?? "-",
      };
    });

    await downloadDailyWorkerUsageStatementXlsx(
      `일용직_사용내역서_${periodLabel}.xlsx`,
      periodLabel,
      total,
      exportItems,
      MONTHLY_DAY_LIMIT
    );
  }

  return (
    <div className="flex shrink-0 flex-nowrap gap-2 print:hidden">
      <PrintButton />
      <Button variant="secondary" size="sm" onClick={handleExport}>
        엑셀 다운로드
      </Button>
    </div>
  );
}
