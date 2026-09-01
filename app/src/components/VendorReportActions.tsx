"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

export function VendorReportActions({
  vendorName,
  year,
  rows,
  total,
}: {
  vendorName: string;
  year: number;
  rows: (string | number)[][];
  total: number;
}) {
  async function handleExport() {
    const data: (string | number)[][] = [...rows, ["", "", "", ""], ["", "", "합계", total]];
    await downloadXlsx(`${vendorName}_매입내역_${year}.xlsx`, ["구분", "날짜", "품목", "금액"], data, `${vendorName} ${year}년`);
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
