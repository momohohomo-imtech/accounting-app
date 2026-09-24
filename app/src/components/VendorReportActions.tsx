"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

export function VendorReportActions({
  vendorName,
  year,
  headers,
  rows,
  totals,
}: {
  vendorName: string;
  year: number;
  headers: string[];
  rows: (string | number)[][];
  /** 맨 아래 합계 줄들 — [이름, 금액]. 기준이 다른 금액(매입/대행구매)은 줄을 나눠서 넘긴다. */
  totals: [string, number][];
}) {
  async function handleExport() {
    const blankRow = headers.map(() => "");
    const totalRows = totals.map(([label, value]) =>
      headers.map((_, i) => (i === headers.length - 2 ? label : i === headers.length - 1 ? value : ""))
    );
    const data: (string | number)[][] = [...rows, blankRow, ...totalRows];
    await downloadXlsx(`${vendorName}_매입내역_${year}.xlsx`, headers, data, `${vendorName} ${year}년`);
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
