"use client";

import { downloadXlsxSheets, type XlsxSheet } from "@/lib/xlsxExport";

// 세무사 열람 "전체 엑셀" — 화면의 표를 한 파일에 장마다 하나씩(세무사에게 보내기 좋게).
export function TaxReviewExcelAll({ filename, sheets }: { filename: string; sheets: XlsxSheet[] }) {
  return (
    <button
      type="button"
      onClick={() => downloadXlsxSheets(filename, sheets)}
      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 print:hidden"
    >
      전체 엑셀
    </button>
  );
}
