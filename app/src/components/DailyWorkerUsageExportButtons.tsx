"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";

type ExportRow = { trans_date: string; client_name: string; amount: number; note: string };

export function DailyWorkerUsageExportButtons({ rows, periodLabel }: { rows: ExportRow[]; periodLabel: string }) {
  async function handleExport() {
    const data = rows.map((r) => [formatDate(r.trans_date), r.client_name, r.amount, r.note]);
    await downloadXlsx(
      `일용직_사용내역_${periodLabel}.xlsx`,
      ["날짜", "거래처", "금액", "비고"],
      data,
      "일용직 사용내역"
    );
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
