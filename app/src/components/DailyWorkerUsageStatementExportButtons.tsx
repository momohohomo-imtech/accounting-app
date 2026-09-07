"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/PrintButton";

type ExportRow = { use_date: string; name: string; resident_id_masked: string | null; phone: string | null; note: string | null };

export function DailyWorkerUsageStatementExportButtons({ rows, periodLabel }: { rows: ExportRow[]; periodLabel: string }) {
  async function handleExport() {
    const data = rows.map((r) => [formatDate(r.use_date), r.name, r.resident_id_masked ?? "-", r.phone ?? "-", r.note ?? "-"]);
    await downloadXlsx(
      `일용직_사용내역서_${periodLabel}.xlsx`,
      ["사용일자", "이름", "주민번호", "전화번호", "비고"],
      data,
      "일용직 사용내역서"
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
