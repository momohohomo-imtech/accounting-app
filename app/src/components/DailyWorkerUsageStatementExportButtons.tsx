"use client";

import { downloadDailyWorkerUsageStatementXlsx } from "@/lib/xlsxExport";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";
import {
  buildStatementBlocks,
  blockDateLabel,
  MONTHLY_DAY_LIMIT,
  type StatementRow,
} from "@/components/DailyWorkerUsageStatementTable";

export function DailyWorkerUsageStatementExportButtons({
  rows,
  periodLabel,
}: {
  rows: StatementRow[];
  periodLabel: string;
}) {
  async function handleExport() {
    const blocks = buildStatementBlocks(rows);
    const total = rows.reduce((s, r) => s + (r.daily_wage ?? 0), 0);

    const exportItems = blocks.flatMap((block, i) => {
      const entries = block.rows.map((r) => ({
        kind: "entry" as const,
        use_date: r.use_date,
        name: r.name,
        monthlyCount: r.monthlyCount,
        residentId: r.resident_id_masked ?? "-",
        phone: r.phone ?? "-",
        dailyWage: r.daily_wage,
        note: r.note ?? "-",
      }));
      const subtotal = {
        kind: "subtotal" as const,
        label: `${block.rows[0].name} ${blockDateLabel(block)} 소계 (${block.rows.length}일)`,
        amount: block.amount,
      };
      const gap = i < blocks.length - 1 ? [{ kind: "gap" as const }] : [];
      return [...entries, subtotal, ...gap];
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
