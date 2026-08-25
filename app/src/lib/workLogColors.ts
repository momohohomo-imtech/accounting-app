export const WORK_LOG_COLORS = [
  { key: "none", label: "없음", swatch: "bg-white border border-slate-300", cell: "bg-white", excelArgb: null },
  { key: "blue", label: "파랑", swatch: "bg-sky-400", cell: "bg-sky-400 text-white", excelArgb: "FF38BDF8" },
  { key: "red", label: "빨강", swatch: "bg-red-500", cell: "bg-red-500 text-white", excelArgb: "FFEF4444" },
  { key: "green", label: "초록", swatch: "bg-lime-400", cell: "bg-lime-400", excelArgb: "FFA3E635" },
  { key: "orange", label: "주황", swatch: "bg-amber-500", cell: "bg-amber-500 text-white", excelArgb: "FFF59E0B" },
  { key: "pink", label: "분홍", swatch: "bg-pink-200", cell: "bg-pink-200", excelArgb: "FFFBCFE8" },
  { key: "gray", label: "회색", swatch: "bg-slate-300", cell: "bg-slate-300", excelArgb: "FFCBD5E1" },
] as const;

export type WorkLogColorKey = (typeof WORK_LOG_COLORS)[number]["key"];

export function workLogColorCellClass(color: string | null | undefined) {
  return WORK_LOG_COLORS.find((c) => c.key === color)?.cell ?? "bg-white";
}

export function workLogColorExcelArgb(color: string | null | undefined) {
  return WORK_LOG_COLORS.find((c) => c.key === color)?.excelArgb ?? null;
}
