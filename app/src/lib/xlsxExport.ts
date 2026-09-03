import ExcelJS from "exceljs";
import type { MonthCell } from "@/lib/calendar";
import { WEEKDAY_LABELS } from "@/lib/calendar";
import { workLogColorExcelArgb } from "@/lib/workLogColors";
import { siteColorExcelArgb } from "@/lib/siteColor";
import { formatPermitQuantity } from "@/lib/koreanNumber";

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

export async function downloadToolChecklistXlsx(
  filename: string,
  title: string,
  metaLine: string,
  groups: { label: string; items: { tool_name: string; quantity: string }[] }[]
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("공구명세서");
  const border = { style: "thin" as const, color: { argb: "FF64748B" } };

  const titleRow = ws.addRow([title]);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 2);

  const metaRow = ws.addRow([metaLine]);
  metaRow.font = { color: { argb: "FF64748B" } };
  ws.mergeCells(metaRow.number, 1, metaRow.number, 2);

  const nonEmptyGroups = groups.filter((g) => g.items.length > 0);
  nonEmptyGroups.forEach((g) => {
    ws.addRow([]);

    const labelRow = ws.addRow([g.label]);
    labelRow.font = { bold: true, size: 11, color: { argb: "FF334155" } };

    const headerRow = ws.addRow(["품목", "수량"]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.eachCell((cell) => {
      cell.border = { top: border, left: border, bottom: border, right: border };
    });

    for (const item of g.items) {
      const filled = item.quantity.trim() !== "";
      const row = ws.addRow([item.tool_name, filled ? item.quantity : "-"]);
      row.eachCell((cell, colNumber) => {
        cell.border = { top: border, left: border, bottom: border, right: border };
        if (colNumber === 2) {
          cell.alignment = { horizontal: "center" };
          if (!filled) cell.font = { color: { argb: "FF94A3B8" } };
        }
      });
    }
  });

  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 14;

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}

// 원청(기아 화성공장)이 요구하는 "반입/반출 확인증" 양식을 셀 단위로 그대로 재현.
// 사용자가 제공한 원본 엑셀(화성 공구 명세서.xlsx)의 셀 값·병합·테두리·문구를 그대로
// 옮긴 것 — 서명/인장이 필요한 칸은 원본처럼 빈칸으로 두고, 품명·수량 칸만 채운다.
function boxBorder(ws: ExcelJS.Worksheet, range: string, style: "thin" | "medium") {
  const border: ExcelJS.Border = { style, color: { argb: "FF000000" } };
  const [startRef, endRef] = range.split(":");
  const start = ws.getCell(startRef).fullAddress;
  const end = ws.getCell(endRef ?? startRef).fullAddress;
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      const cell = ws.getCell(r, c);
      const next = { ...cell.border } as ExcelJS.Borders;
      if (r === start.row) next.top = border;
      if (r === end.row) next.bottom = border;
      if (c === start.col) next.left = border;
      if (c === end.col) next.right = border;
      cell.border = next;
    }
  }
}

export async function downloadAccessPassFormXlsx(
  filename: string,
  items: { tool_name: string; quantity: string }[]
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("반입반출확인증");
  const FONT = "맑은 고딕";
  ws.properties.defaultRowHeight = 16.5;

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };

  ws.columns = [
    { width: 8.43 },
    { width: 16 },
    { width: 8.43 },
    { width: 8.43 },
    { width: 16 },
    { width: 8.43 },
    { width: 8.43 },
  ];
  ws.getRow(1).height = 24.75;
  ws.getRow(2).height = 25.9;
  ws.getRow(3).height = 25.9;

  ws.mergeCells("C1:G2");
  ws.getCell("B1").value = "KIA MOTORS";
  ws.getCell("B1").font = { name: FONT, size: 16.5 };
  ws.getCell("B1").alignment = { vertical: "middle" };
  ws.getCell("B2").value = "HAWSUNG PLANT";
  ws.getCell("B2").font = { name: FONT, size: 16.5 };
  ws.getCell("B2").alignment = { vertical: "middle" };
  const titleCell = ws.getCell("C1");
  titleCell.value = "반입 /반출 확인증(부품,공구,기타)";
  titleCell.font = { name: FONT, size: 24, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = { bottom: { style: "medium", color: { argb: "FF000000" } } };

  try {
    const res = await fetch("/kia-logo.png");
    const buffer = await res.arrayBuffer();
    const imageId = wb.addImage({ buffer, extension: "png" });
    ws.addImage(imageId, { tl: { col: 0.15, row: 0.05 }, ext: { width: 180, height: 118 } });
  } catch {
    // 로고 이미지를 못 불러와도 나머지 양식은 그대로 다운로드되게 둠.
  }

  const infoRow: [string, string][] = [
    ["A3:B3", "반입자 : "],
    ["C3:E3", " 전화번호 : "],
    ["F3:G3", "반입 목적: "],
  ];
  for (const [range, text] of infoRow) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = text;
    cell.font = { name: FONT, size: 16.5 };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    boxBorder(ws, range, "medium");
  }

  const headers: [string, string][] = [
    ["A4", "차종"],
    ["B4", "품명"],
    ["C4:D4", "수량"],
    ["E4", "단위"],
    ["F4", "부품상태"],
    ["G4", "반출수량"],
  ];
  for (const [range, text] of headers) {
    if (range.includes(":")) ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = text;
    cell.font = { name: FONT, size: 16.5 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // 작성 줄 수 30개 고정(실제 품목이 더 많으면 Math.max로 자동으로 늘어남) —
  // 워크시트의 fitToPage 설정이 1페이지에 맞게 알아서 축소해줌.
  const ROW_COUNT = 30;
  const rowCount = Math.max(ROW_COUNT, items.length);
  for (let i = 0; i < rowCount; i++) {
    const r = 5 + i;
    const item = items[i];
    ws.getRow(r).height = 27;
    ws.mergeCells(`C${r}:D${r}`);
    const nameCell = ws.getCell(`B${r}`);
    nameCell.value = item?.tool_name ?? "";
    nameCell.font = { name: FONT, size: 16.5 };
    const qtyCell = ws.getCell(`C${r}`);
    qtyCell.value = item ? formatPermitQuantity(item.quantity) : "";
    qtyCell.font = { name: FONT, size: 16.5 };
    qtyCell.alignment = { horizontal: "center" };
    const unitCell = ws.getCell(`E${r}`);
    unitCell.value = item ? "EA" : "";
    unitCell.alignment = { horizontal: "center" };
    for (let c = 1; c <= 7; c++) ws.getCell(r, c).font = { name: FONT, size: 16.5 };
  }
  // 표 안쪽 가로줄(행 사이)과 세로줄(열 사이), 바깥 굵은 테두리.
  for (let r = 5; r <= 4 + rowCount; r++) {
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(r, c);
      cell.border = { ...cell.border, top: { style: "thin", color: { argb: "FF000000" } } };
    }
  }
  for (let r = 4; r <= 4 + rowCount; r++) {
    for (const c of [1, 2, 4, 5, 6]) {
      const cell = ws.getCell(r, c);
      cell.border = { ...cell.border, right: { style: "thin", color: { argb: "FF000000" } } };
    }
  }
  boxBorder(ws, `A4:G${4 + rowCount}`, "medium");

  const noteRow = 5 + rowCount;
  ws.mergeCells(`A${noteRow}:G${noteRow}`);
  const noteCell = ws.getCell(`A${noteRow}`);
  noteCell.value = "#이 반입증은 부서{팀} 확인자 서명및 출문승인 (통제부서) 통제틸후 출문 가능함.";
  noteCell.font = { name: FONT, size: 16.5, bold: true };
  noteCell.alignment = { horizontal: "center", vertical: "middle" };

  const r1 = noteRow + 1; // "상기물품이 화성공장으로 반입됨을 확인함"
  const r2 = r1 + 1; // 월/일
  const r3 = r2 + 1; // 경비실 확인자
  const r4 = r3 + 1; // "상기물품은 화성공장 물품이아님을 확인함"
  const r5 = r4 + 1; // 월/일
  const r6 = r5 + 1; // 부서(팀)명
  const r7 = r6 + 1; // 부서(팀) 확인자

  ws.getCell(`A${r1}`).value = "상기물품이 화성공장으로 반입됨을 확인함";
  ws.getCell(`C${r2}`).value = "월";
  ws.getCell(`D${r2}`).value = "일";
  ws.mergeCells(`A${r3}:D${r3}`);
  ws.getCell(`A${r3}`).value = "경비실 확인자:                                (서명)";
  ws.getCell(`A${r4}`).value = "상기물품은 화성공장 물품이아님을 확인함";
  ws.getCell(`C${r5}`).value = "월";
  ws.getCell(`D${r5}`).value = "일";
  ws.mergeCells(`A${r6}:D${r6}`);
  ws.getCell(`A${r6}`).value = "부서(팀)명:                            ";
  ws.mergeCells(`A${r7}:D${r7}`);
  ws.getCell(`A${r7}`).value = "부서(팀) 확인자:                              (인)";

  ws.mergeCells(`E${r1}:E${r7}`);
  ws.getCell(`E${r1}`).value = "반입확인(경비실)";
  ws.mergeCells(`F${r1}:G${r1}`);
  ws.getCell(`F${r1}`).value = "출문승인(통제부서)";
  ws.mergeCells(`F${r2}:G${r7}`);

  for (let r = r1; r <= r7; r++) {
    ws.getRow(r).height = r === r2 || r === r5 ? 25 : 29;
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: FONT, size: 16.5 };
      if (c === 1) cell.alignment = { horizontal: r === r3 || r === r6 || r === r7 ? "center" : "left", vertical: "middle" };
      else cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  }

  boxBorder(ws, `A${r1}:D${r3}`, "thin");
  boxBorder(ws, `A${r4}:D${r7}`, "thin");
  boxBorder(ws, `E${r1}:E${r7}`, "thin");
  boxBorder(ws, `F${r1}:G${r1}`, "thin");
  boxBorder(ws, `F${r2}:G${r7}`, "thin");

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
    fitToHeight: 0, // 세로는 제한 없이 여러 페이지로 자연스럽게 넘어가게 둠(사람 수만큼 행이 늘어나므로).
    horizontalCentered: true,
    margins: { left: 0.35, right: 0.35, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    // 페이지가 넘어가도 매 페이지 상단에 제목~헤더(1~4행)가 그대로 반복되게(인쇄 제목).
    printTitlesRow: "1:4",
  };
  // 바닥글: 안내문 두 줄(가운데) + 페이지 번호(오른쪽). Excel 바닥글의 줄바꿈은 _x000A_로 표기.
  ws.headerFooter.oddFooter =
    "&C&12인원수 대로 신분증 제출 요망_x000A_(명단 제출 → 선 출입 후 명단으로 출입보안승인 / 출입보안 미등록시  공사 진행 불가&R&12&P / &N";

  const titleRow = ws.addRow([
    { richText: [
      { font: { name: FONT, size: 14 }, text: "공사자 출입자 명부" },
      { font: { name: FONT, size: 12 }, text: " sjc0143@gmail.com" },
    ] },
  ]);
  titleRow.height = 30.75;
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  ws.mergeCells(1, 1, 1, 6);

  const row2 = ws.addRow(["업체명:", info.companyName, "", "출입일자:", info.accessPeriod, ""]);
  row2.height = 30.75;
  ws.mergeCells(2, 5, 2, 6);
  [1, 2, 4, 5].forEach((c) => {
    row2.getCell(c).font = { name: FONT, size: 12 };
    row2.getCell(c).alignment = { horizontal: c === 1 || c === 4 ? "right" : "center", vertical: "middle" };
  });

  const row3 = ws.addRow(["감독자:", info.supervisorName, "", "인원수:", members.length, ""]);
  row3.height = 39.0;
  ws.mergeCells(3, 5, 3, 6);
  [1, 2, 4, 5].forEach((c) => {
    row3.getCell(c).font = { name: FONT, size: 12 };
    row3.getCell(c).alignment = { horizontal: c === 1 || c === 4 ? "right" : "center", vertical: "middle" };
  });

  const headerRow = ws.addRow(["구분", "성 명", "생년월일", "연락처", "국적", "비고"]);
  headerRow.height = 26.25;
  headerRow.eachCell((cell) => {
    cell.font = { name: FONT, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin" } };
  });

  // 사람 수만큼만 행을 만듦(예: 4명이면 번호 1~4까지만) — 예전처럼 21행까지 빈 줄로 채우지 않음.
  members.forEach((m, i) => {
    const row = ws.addRow([i + 1, m.name, m.birthDate, m.phone, m.nationality, m.note]);
    row.height = 26.25;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, size: 12 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin" } };
    });
  });

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
