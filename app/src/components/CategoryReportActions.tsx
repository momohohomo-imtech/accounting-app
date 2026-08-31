"use client";

import { downloadXlsx } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

export function CategoryReportActions({
  categoryName,
  year,
  rows,
  purchaseTotal,
  agencyTotal,
}: {
  categoryName: string;
  year: number;
  rows: (string | number)[][];
  purchaseTotal: number;
  agencyTotal: number;
}) {
  async function handleExport() {
    const data: (string | number)[][] = [
      ...rows,
      ["", "", "", "", "", ""],
      ["", "", "", "", "매입 합계", purchaseTotal],
      ["", "", "", "", "대행구매액 합계", agencyTotal],
    ];
    await downloadXlsx(
      `${categoryName}_카테고리별_매입내역_${year}.xlsx`,
      ["구분", "날짜", "거래처", "프로젝트", "품목", "금액"],
      data,
      `${categoryName} ${year}년`
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
