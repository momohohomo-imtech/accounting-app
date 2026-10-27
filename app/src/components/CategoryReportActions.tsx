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
  categoryTotals,
}: {
  categoryName: string;
  year: number;
  rows: (string | number)[][];
  purchaseTotal: number;
  agencyTotal: number;
  // 여러 카테고리를 한 번에 볼 때 — 줄마다 "카테고리" 칸이 들어가고(rows에 이미 포함) 카테고리별 합계 줄도.
  categoryTotals?: { name: string; purchase: number; agency: number }[];
}) {
  async function handleExport() {
    const multi = Boolean(categoryTotals);
    const pad = (label: string, value: number | string) => [...Array(multi ? 5 : 4).fill(""), label, value];
    const data: (string | number)[][] = [
      ...rows,
      pad("", ""),
      ...(categoryTotals ?? []).flatMap((c) => [pad(`${c.name} 매입`, c.purchase), pad(`${c.name} 대행구매`, c.agency)]),
      pad("매입 합계", purchaseTotal),
      pad("대행구매액 합계", agencyTotal),
    ];
    await downloadXlsx(
      `${categoryName}_카테고리별_매입내역_${year}.xlsx`,
      multi
        ? ["구분", "카테고리", "날짜", "거래처", "프로젝트", "품목", "금액"]
        : ["구분", "날짜", "거래처", "프로젝트", "품목", "금액"],
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
