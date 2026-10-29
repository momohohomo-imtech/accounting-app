"use client";

import { downloadXlsxSheets, type XlsxSheet } from "@/lib/xlsxExport";
import { PrintButton } from "@/components/PrintButton";
import { Button } from "@/components/ui/Button";

type Cell = string | number;

// 통합 보고서 인쇄·엑셀 — 엑셀은 시트별로 프로젝트별 합계(+ 요약), 매입내역, 대행구매, 받은 돈 내역(내역이 없는 시트는 뺌).
export function ProjectsCombinedReportActions({
  filename,
  title,
  infoLines,
  unitRows,
  totalRow,
  summaryRows,
  purchaseRows,
  agencyRows,
  receiptRows,
}: {
  filename: string;
  title: string;
  infoLines: string[];
  unitRows: Cell[][];
  totalRow: Cell[];
  summaryRows: [string, Cell][];
  purchaseRows: Cell[][];
  agencyRows: Cell[][];
  receiptRows: Cell[][];
}) {
  async function handleExport() {
    const sheets: XlsxSheet[] = [
      {
        name: "통합 보고서",
        leadingRows: [[title], ...infoLines.map((line) => [line]), []],
        headers: ["프로젝트번호", "프로젝트명", "현장", "상태", "발주액", "대행구매액", "매입(부가세 제외)", "이익금", "이익율(%)", "받은 금액", "남은 금액"],
        rows: [...unitRows, totalRow, [], ...summaryRows.map(([label, value]) => [label, value])],
      },
      {
        name: "매입내역",
        headers: ["날짜", "프로젝트", "거래처", "품목", "카테고리", "금액(부가세 포함)", "비고"],
        rows: purchaseRows,
      },
      { name: "대행구매", headers: ["프로젝트", "거래처", "품목", "카테고리", "금액", "메모"], rows: agencyRows },
      {
        name: "받은 돈 내역",
        headers: ["계산서 날짜", "프로젝트", "거래처", "품목", "계산서 금액(부가세 포함)", "받은 돈", "입금 상태", "입금일"],
        rows: receiptRows,
      },
    ];
    await downloadXlsxSheets(`${filename}.xlsx`, sheets.filter((s, i) => i === 0 || s.rows.length > 0));
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
