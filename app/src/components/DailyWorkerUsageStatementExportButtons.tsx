"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { formatDate, formatWon } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";
import { buildStatementDisplayItems, type StatementRow } from "@/components/DailyWorkerUsageStatementTable";

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

    const data = items.map((item) => {
      if (item.kind === "gap") return ["", "", "", "", "", ""];
      if (item.kind === "subtotal") return ["", `소계 (${item.days}일)`, "", "", item.amount, ""];
      const r = item.row;
      return [formatDate(r.use_date), r.name, r.resident_id_masked ?? "-", r.phone ?? "-", r.daily_wage ?? "", r.note ?? "-"];
    });

    await downloadXlsx(
      `일용직_사용내역서_${periodLabel}.xlsx`,
      ["사용일자", "이름", "주민번호", "전화번호", "일급", "비고"],
      data,
      "일용직 사용내역서",
      [[`${periodLabel} 지급액 ${formatWon(total)}`]]
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
