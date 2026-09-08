"use client";

import { downloadXlsx } from "@/lib/xlsxExport";

export function ReportExcelButton({
  filename,
  headers,
  rows,
  sheetName,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  sheetName?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadXlsx(filename, headers, rows, sheetName)}
      className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 print:hidden"
    >
      엑셀
    </button>
  );
}
