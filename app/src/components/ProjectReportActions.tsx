"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

export function ProjectReportActions({
  filename,
  title,
  exportRows,
}: {
  filename: string;
  title: string;
  exportRows: (string | number)[][];
}) {
  async function handleExport() {
    await downloadXlsx(`${filename}.xlsx`, ["날짜", "거래처", "품목", "금액"], exportRows, title.slice(0, 31) || "손익보고서");
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
