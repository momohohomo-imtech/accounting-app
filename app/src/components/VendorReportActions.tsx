"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

export function VendorReportActions({
  vendorName,
  year,
  headers,
  rows,
  total,
}: {
  vendorName: string;
  year: number;
  headers: string[];
  rows: (string | number)[][];
  total: number;
}) {
  async function handleExport() {
    const blankRow = headers.map(() => "");
    const totalRow = headers.map((_, i) => (i === headers.length - 2 ? "합계" : i === headers.length - 1 ? total : ""));
    const data: (string | number)[][] = [...rows, blankRow, totalRow];
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
