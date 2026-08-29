import ExcelJS from "exceljs";
import type { MonthCell } from "@/lib/calendar";
import { WEEKDAY_LABELS } from "@/lib/calendar";
import { workLogColorExcelArgb } from "@/lib/workLogColors";
import { siteColorExcelArgb } from "@/lib/siteColor";

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
  leadingRows: (string | number)[][] = [],
  /** rows와 같은 순서로, 해당 행에 배경색을 줄 ARGB 코드(예: "FFDCFCE7") 또는 null(기본색 유지). */
  rowFillArgb?: (string | null)[]
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

  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    const argb = rowFillArgb?.[i];
    if (argb) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  });

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

export async function downloadAccessListXlsx(
  filename: string,
  info: { companyName: string; accessPeriod: string; supervisorName: string },
  members: { name: string; birthDate: string; phone: string; nationality: string; note: string }[]
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("출입명단");
  const FONT = "맑은 고딕";

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    margins: { left: 0.35, right: 0.35, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  const titleRow = ws.addRow(["공사자 출입자 명부"]);
  titleRow.height = 30.75;
  titleRow.font = { name: FONT, size: 12 };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(1, 1, 1, 6);

  const row2 = ws.addRow(["업체명:", info.companyName, "", "출입일자:", info.accessPeriod, ""]);
  row2.height = 30.75;
  ws.mergeCells(2, 5, 2, 6);
  [1, 2].forEach((c) => {
    row2.getCell(c).font = { name: FONT, size: 12 };
    row2.getCell(c).alignment = { horizontal: c === 1 ? "right" : "center", vertical: "middle" };
  });
  [4, 5].forEach((c) => {
    row2.getCell(c).font = { name: FONT, size: 14 };
    row2.getCell(c).alignment = { horizontal: c === 4 ? "right" : "center", vertical: "middle" };
  });

  const row3 = ws.addRow(["감독자:", info.supervisorName, "", "인원수:", members.length, ""]);
  row3.height = 39.0;
  ws.mergeCells(3, 5, 3, 6);
  [1, 2].forEach((c) => {
    row3.getCell(c).font = { name: FONT, size: 12 };
    row3.getCell(c).alignment = { horizontal: c === 1 ? "right" : "center", vertical: "middle" };
  });
  [4, 5].forEach((c) => {
    row3.getCell(c).font = { name: FONT, size: 14 };
    row3.getCell(c).alignment = { horizontal: c === 4 ? "right" : "center", vertical: "middle" };
  });

  const headerRow = ws.addRow(["구분", "성 명", "생년월일", "연락처", "국적", "비고"]);
  headerRow.height = 26.25;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: FONT, size: colNumber <= 2 ? 12 : 14 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin" } };
  });

  const totalSlots = Math.max(21, members.length);
  for (let i = 0; i < totalSlots; i++) {
    const m: (typeof members)[number] | undefined = members[i];
    const row = ws.addRow([i + 1, m?.name ?? "", m?.birthDate ?? "", m?.phone ?? "", m?.nationality ?? "", m?.note ?? ""]);
    row.height = 26.25;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, size: 12 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  ws.getColumn(1).width = 9;
  ws.getColumn(2).width = 14.375;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 18.375;
  ws.getColumn(5).width = 15.75;
  ws.getColumn(6).width = 20;

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}

export async function downloadWorkLogCalendarXlsx(
  filename: string,
  year: number,
  month: number,
  weeks: MonthCell[][],
  logsByDate: Map<string, { title: string; color: string | null; site_id: string | null }[]>,
  sites: { id: string; name: string; color: string | null }[] = []
) {
  const siteById = new Map(sites.map((s) => [s.id, s]));
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
      const entryRow = ws.addRow(
        week.map((c) => {
          const entry = logsByDate.get(c.dateKey)?.[i];
          if (!entry) return "";
          return entry.title?.trim() || (entry.site_id ? siteById.get(entry.site_id)?.name : "") || "";
        })
      );
      entryRow.eachCell((cell, colNumber) => {
        const entry = logsByDate.get(week[colNumber - 1].dateKey)?.[i];
        const argb = entry
          ? entry.site_id
            ? siteColorExcelArgb(entry.site_id, siteById.get(entry.site_id)?.color)
            : workLogColorExcelArgb(entry.color)
          : null;
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
