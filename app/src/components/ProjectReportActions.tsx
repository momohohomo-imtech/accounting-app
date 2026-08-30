"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

export function ProjectReportActions({
  filename,
  title,
  infoLines,
  exportRows,
  agencyExportRows = [],
  summaryRows,
}: {
  filename: string;
  title: string;
  infoLines: string[];
  exportRows: (string | number)[][];
  agencyExportRows?: [string, number][];
  summaryRows: [string, string | number][];
}) {
  async function handleExport() {
    const leadingRows: (string | number)[][] = [[title], ...infoLines.map((line) => [line]), []];
    const rows: (string | number)[][] = [
      ...exportRows,
      ["", "", "", ""],
      ...(agencyExportRows.length > 0
        ? [
            ["", "", "── 대행구매액 ──", ""] as (string | number)[],
            ...agencyExportRows.map(([name, amount]) => ["", "", name, amount] as (string | number)[]),
            ["", "", "", ""],
          ]
        : []),
      ...summaryRows.map(([label, value]) => ["", "", label, value] as (string | number)[]),
    ];
    await downloadXlsx(
      `${filename}.xlsx`,
      ["날짜", "거래처", "품목", "금액"],
      rows,
      title.slice(0, 31) || "손익보고서",
      leadingRows
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
