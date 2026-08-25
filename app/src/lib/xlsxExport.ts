import ExcelJS from "exceljs";
import type { MonthCell } from "@/lib/calendar";
import { WEEKDAY_LABELS } from "@/lib/calendar";
import { workLogColorExcelArgb } from "@/lib/workLogColors";

function triggerDownload(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadXlsx(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  sheetName = "Sheet1",
  leadingRows: (string | number)[][] = []
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: leadingRows.length + 1 }] });

  leadingRows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.font = { bold: i === 0 };
  });

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  ws.addRows(rows);

  const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
    });
  });

  const colCount = Math.max(headers.length, ...leadingRows.map((r) => r.length), ...rows.map((r) => r.length), 1);
  for (let i = 1; i <= colCount; i++) {
    let maxLen = String(headers[i - 1] ?? "").length;
    ws.eachRow((row) => {
      const len = String(row.getCell(i).value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    ws.getColumn(i).width = Math.min(Math.max(maxLen + 2, 10), 40);
  }

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}

export async function downloadWorkLogCalendarXlsx(
  filename: string,
  year: number,
  month: number,
  weeks: MonthCell[][],
  logsByDate: Map<string, { title: string; color: string | null }[]>
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${year}-${String(month).padStart(2, "0")}`);

  const titleRow = ws.addRow([`${year}년 ${month}월 작업일지`]);
  titleRow.font = { bold: true, size: 16 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 7);
  ws.addRow([]);

  const headerRow = ws.addRow(WEEKDAY_LABELS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.alignment = { horizontal: "center" };
  });

  for (const week of weeks) {
    const dayRow = ws.addRow(week.map((c) => c.day));
    dayRow.eachCell((cell, colNumber) => {
      const c = week[colNumber - 1];
      cell.font = { bold: true, color: { argb: c.inMonth ? "FF1E293B" : "FF94A3B8" } };
      cell.alignment = { horizontal: "right" };
    });

    for (let i = 0; i < 5; i++) {
      const entryRow = ws.addRow(week.map((c) => logsByDate.get(c.dateKey)?.[i]?.title ?? ""));
      entryRow.eachCell((cell, colNumber) => {
        const entry = logsByDate.get(week[colNumber - 1].dateKey)?.[i];
        const argb = entry ? workLogColorExcelArgb(entry.color) : null;
        if (argb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      });
    }
  }

  const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
    });
  });

  ws.columns.forEach((col) => {
    col.width = 20;
  });

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}
