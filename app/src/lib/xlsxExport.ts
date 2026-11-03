import ExcelJS from "exceljs";
import type { MonthCell } from "@/lib/calendar";
import { WEEKDAY_LABELS } from "@/lib/calendar";
import { workLogColorExcelArgb } from "@/lib/workLogColors";
import { siteColorExcelArgb } from "@/lib/siteColor";
import { formatPermitQuantity } from "@/lib/koreanNumber";
import {
  formatAmount,
  teamColor,
  tintHex,
  UNIT_LABEL,
  type ChartColumn,
  type ScheduledStep,
  type SequenceUnit,
  type TeamColorKey,
} from "@/lib/workSequence";
import {
  chunkForRows,
  MEMO_LINE_HEIGHT,
  MEMO_MAX_LINES_PER_ROW,
  MEMO_VALUE_WIDTH,
  wrappedLineCount,
  type MemoField,
} from "@/lib/memoExport";

function triggerDownload(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type XlsxSheet = {
  name: string;
  headers: string[];
  rows: (string | number)[][];
  leadingRows?: (string | number)[][];
};

export async function downloadXlsx(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  sheetName = "Sheet1",
  leadingRows: (string | number)[][] = []
) {
  await downloadXlsxSheets(filename, [{ name: sheetName, headers, rows, leadingRows }]);
}

// 시트 여러 개짜리 엑셀(통합 보고서 — 프로젝트별·매입내역·대행구매·받은 돈 내역). 시트마다 downloadXlsx와 같은 모양.
export async function downloadXlsxSheets(filename: string, sheets: XlsxSheet[]) {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) addSheet(wb, sheet);
  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}

function addSheet(wb: ExcelJS.Workbook, { name: sheetName, headers, rows, leadingRows = [] }: XlsxSheet) {
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
}

// 메모 한 장(공사 메모·품질관리 노하우·공구 메모) — "항목 | 내용" 두 칸짜리 문서(lib/memoExport.ts). 내용 칸은 줄바꿈해서 다 보이게
// 줄 높이를 글자 수로 정하고, 한 칸에 다 안 들어가는 긴 내용은 행 여러 개로 나눠 항목 칸을 세로로 합침. A4 세로 폭에 맞춰 인쇄.
export async function downloadMemoXlsx(filename: string, title: string, fields: MemoField[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("메모", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = MEMO_VALUE_WIDTH + 2;
  const border = { style: "thin" as const, color: { argb: "FF94A3B8" } };
  const box = { top: border, left: border, bottom: border, right: border };

  const titleRow = ws.addRow([title]);
  titleRow.font = { bold: true, size: 14 };
  titleRow.height = 26;
  titleRow.alignment = { vertical: "middle" };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 2);

  for (const [label, value] of fields) {
    const chunks = chunkForRows(value, MEMO_VALUE_WIDTH, MEMO_MAX_LINES_PER_ROW);
    const first = ws.rowCount + 1;
    chunks.forEach((chunk, i) => {
      const row = ws.addRow([i === 0 ? label : "", chunk]);
      row.height = Math.max(20, wrappedLineCount(chunk, MEMO_VALUE_WIDTH) * MEMO_LINE_HEIGHT + 5);
      const labelCell = row.getCell(1);
      labelCell.font = { bold: true, color: { argb: "FF334155" } };
      labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      labelCell.alignment = { vertical: "top", horizontal: "center" };
      labelCell.border = box;
      const valueCell = row.getCell(2);
      valueCell.alignment = { vertical: "top", wrapText: true };
      valueCell.border = box;
    });
    if (chunks.length > 1) ws.mergeCells(first, 1, first + chunks.length - 1, 1);
  }

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}

export type WorkSequenceExport = {
  title: string;
  projectLabel: string;
  unit: SequenceUnit;
  startLabel: string;
  rangeLabel: string;
  doneLabel: string;
  /** "예상 완료 11-07 (1일 늦음)"·"실제 완료 …" — 계획대로면 null(lib/workSequence.ts forecastSummary) */
  forecastLabel: string | null;
  /** 팀 칸·팀 색을 넣음(100 SQL 뒤 팀이 있는 순서표) */
  withTeams: boolean;
  /** 범례에 보일 팀(쓴 팀 + 팀 미정) */
  legendTeams: { name: string; color: TeamColorKey | null }[];
  steps: {
    /** 순서표 순번(팀별 보기로 일부만 담아도 원래 순번) */
    no: number;
    content: string;
    detail: string;
    duration: number;
    overlap: number;
    range: string;
    /** 예상 일정 글자(늦어진 만큼 밀린 미완료 단계만, 아니면 "") */
    forecast: string;
    /** 예상 일정 구간(순서표 시작부터) — 흐름 차트 점선 칸 */
    forecastSpan: { start: number; end: number } | null;
    done: boolean;
    done_date: string | null;
    /** 앞 작업 글자("바로 앞"·"처음부터"·"2번 뒤") */
    after: string;
    /** 진행 상태 글자("2일 지남"·"진행 중"·"같은 팀 5번과 겹침"…) */
    status: string;
    overdue: boolean;
    /** 맡은 팀(없으면 팀 미정) */
    team: { name: string; color: TeamColorKey } | null;
  }[];
  /** steps와 같은 순서의 일정 */
  schedule: ScheduledStep[];
  columns: ChartColumn[];
  /** 오늘(지금) 칸 위치(0부터) — 차트 머리글에 표시, 차트 밖이면 null */
  todayColumn: number | null;
};

const argbOf = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

// 공사 작업 순서표(사용자 요청 11/2 "엑셀 + 인쇄") — 1장 "작업 순서"(순서표 정보 + 단계 표), 2장 "흐름 차트"(칸 하나 = 하루 또는 한
// 시간). 화면 차트와 같게 색 = 팀(팀 미정은 남색), 모양 = 상태: 완료는 옅은 칸, 계획보다 늦음은 빨간 굵은 테두리, 앞 작업과 겹치는 칸은
// 빗금(사용자 결정 11/2 "팀별 색"). 칸은 400개까지(그 뒤는 잘림 안내).
const WORK_SEQUENCE_MAX_COLUMNS = 400;
export async function downloadWorkSequenceXlsx(filename: string, data: WorkSequenceExport) {
  const wb = new ExcelJS.Workbook();
  const border = { style: "thin" as const, color: { argb: "FF94A3B8" } };
  const box = { top: border, left: border, bottom: border, right: border };
  const unitLabel = UNIT_LABEL[data.unit];

  // 1장: 작업 순서 — 칸 목록(팀 칸은 팀이 있을 때만)
  type SheetCol = { header: string; width: number; value: (s: WorkSequenceExport["steps"][number], i: number) => string | number; center?: boolean; wrap?: boolean };
  const sheetCols: SheetCol[] = [
    { header: "순번", width: 6, value: (s) => s.no, center: true },
    { header: "작업 내용", width: 26, value: (s) => s.content, wrap: true },
    ...(data.withTeams ? [{ header: "팀", width: 12, value: (s: WorkSequenceExport["steps"][number]) => s.team?.name ?? "팀 미정", center: true }] : []),
    { header: "세부 설명·주의사항", width: 42, value: (s) => s.detail, wrap: true },
    { header: "앞 작업", width: 10, value: (s) => s.after, center: true },
    { header: `기간(${unitLabel})`, width: 10, value: (s) => s.duration, center: true },
    {
      header: `앞 작업과 겹침(${unitLabel})`,
      width: 14,
      value: (s, i) => (s.no === 1 || data.schedule[i]?.predecessor === null ? "-" : data.schedule[i]?.overlap ?? s.overlap),
      center: true,
    },
    { header: "일정", width: 24, value: (s) => s.range, center: true },
    ...(data.steps.some((s) => s.forecast)
      ? [{ header: "예상 일정", width: 22, value: (s: WorkSequenceExport["steps"][number]) => s.forecast, center: true }]
      : []),
    { header: "상태", width: 18, value: (s) => s.status, center: true, wrap: true },
    { header: "완료", width: 8, value: (s) => (s.done ? "완료" : ""), center: true },
    { header: "완료일", width: 12, value: (s) => (s.done ? s.done_date ?? "" : ""), center: true },
  ];
  const lastCol = sheetCols.length;
  const teamCol = data.withTeams ? 3 : 0;
  const statusCol = sheetCols.findIndex((c) => c.header === "상태") + 1;

  const ws = wb.addWorksheet("작업 순서", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const titleRow = ws.addRow([data.title]);
  titleRow.font = { bold: true, size: 14 };
  titleRow.height = 24;
  ws.mergeCells(titleRow.number, 1, titleRow.number, lastCol);
  for (const [label, value] of [
    ["프로젝트", data.projectLabel],
    ["단위", data.unit === "day" ? "일(날짜, 토·일 포함)" : "시간"],
    ["시작", data.startLabel],
    ["전체 일정", data.rangeLabel],
    ["완료", data.doneLabel],
    ...(data.forecastLabel ? [["예상", data.forecastLabel]] : []),
  ]) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: "FF334155" } };
    ws.mergeCells(row.number, 2, row.number, lastCol);
  }
  ws.addRow([]);
  const header = ws.addRow(sheetCols.map((c) => c.header));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 30;
  header.eachCell((cell) => (cell.border = box));
  data.steps.forEach((s, i) => {
    const row = ws.addRow(sheetCols.map((c) => c.value(s, i)));
    const lines = Math.max(wrappedLineCount(s.content, 24), wrappedLineCount(s.detail || " ", 40), wrappedLineCount(s.status || " ", 16));
    row.height = Math.max(20, Math.min(400, lines * MEMO_LINE_HEIGHT + 5));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const spec = sheetCols[col - 1];
      cell.border = box;
      cell.alignment = { vertical: "top", wrapText: Boolean(spec?.wrap), horizontal: spec?.center ? "center" : undefined };
    });
    if (s.overdue) row.getCell(statusCol).font = { bold: true, color: { argb: "FFDC2626" } };
    else if (/겹침/.test(s.status)) row.getCell(statusCol).font = { bold: true, color: { argb: "FFB45309" } };
    if (teamCol) {
      const color = teamColor(s.team?.color ?? null);
      row.getCell(teamCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbOf(tintHex(color.hex, 0.3)) } };
      row.getCell(teamCol).font = { bold: true, color: { argb: "FF0F172A" } };
    }
  });
  sheetCols.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

  // 2장: 흐름 차트
  const chart = wb.addWorksheet("흐름 차트", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cols = data.columns.slice(0, WORK_SEQUENCE_MAX_COLUMNS);
  const top = chart.addRow(["순번", "작업 내용", ...cols.map((c, i) => (i === data.todayColumn ? "오늘" : c.sub))]);
  const second = chart.addRow(["", "", ...cols.map((c) => c.label)]);
  for (const row of [top, second]) {
    row.font = { bold: true, size: 9, color: { argb: "FF334155" } };
    row.alignment = { horizontal: "center", vertical: "middle" };
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = box;
      const c = cols[col - 3];
      if (col - 3 === data.todayColumn) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCA5A5" } };
        cell.font = { bold: true, size: 9, color: { argb: "FF7F1D1D" } };
      } else if (c?.weekend) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
    });
  }
  chart.mergeCells(1, 1, 2, 1);
  chart.mergeCells(1, 2, 2, 2);
  const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const late = { style: "medium" as const, color: { argb: "FFD03B3B" } };
  data.steps.forEach((s, i) => {
    const sch = data.schedule[i];
    const mark = s.done ? "✓ " : s.overdue ? "! " : "";
    const teamText = data.withTeams ? `[${s.team?.name ?? "팀 미정"}] ` : "";
    const row = chart.addRow([s.no, `${mark}${teamText}${s.content} (${formatAmount(sch.end - sch.start, data.unit)})`]);
    row.height = 18;
    row.getCell(1).alignment = { horizontal: "center" };
    if (s.overdue) row.getCell(2).font = { bold: true, color: { argb: "FFB91C1C" } };
    const color = teamColor(s.team?.color ?? null);
    const barArgb = argbOf(s.done ? tintHex(color.hex, 0.25) : color.hex);
    const firstCol = Math.max(0, Math.floor(sch.start));
    const lastBarCol = Math.min(cols.length - 1, Math.ceil(sch.end) - 1);
    for (let c = 0; c < cols.length; c++) {
      const cell = row.getCell(c + 3);
      cell.border = box;
      // 칸 [c, c+1)이 단계 [start, end)와 겹치면 팀 색 — 앞 작업과 겹치는 부분 [start, start+overlap)은 빗금
      if (c + 1 <= sch.start || c >= sch.end) {
        // 계획 밖인데 예상(늦어진 만큼 밀림) 안이면 옅은 칸 + 점선 테두리
        const f = s.forecastSpan;
        if (f && c + 1 > f.start && c < f.end) {
          const dash = { style: "dashed" as const, color: { argb: argbOf(color.hex) } };
          cell.fill = fill(argbOf(tintHex(color.hex, 0.15)));
          cell.border = { top: dash, bottom: dash, left: border, right: c + 1 >= f.end ? dash : border };
        } else if (cols[c].weekend) cell.fill = fill("FFFFF1F2");
        continue;
      }
      const inOverlap = sch.overlap > 0 && c < sch.start + sch.overlap;
      cell.fill = inOverlap
        ? { type: "pattern", pattern: "darkUp", fgColor: { argb: s.done ? "FF94A3B8" : "FFFFFFFF" }, bgColor: { argb: barArgb } }
        : fill(barArgb);
      if (s.overdue) {
        cell.border = {
          top: late,
          bottom: late,
          left: c === firstCol ? late : border,
          right: c === lastBarCol ? late : border,
        };
      }
    }
  });
  if (data.columns.length > cols.length) {
    chart.addRow([]);
    chart.addRow(["", `칸이 ${data.columns.length}개라 앞 ${cols.length}칸만 그렸습니다.`]);
  }
  chart.addRow([]);
  chart.addRow([
    "",
    `칸 하나 = ${data.unit === "day" ? "하루" : "한 시간"} · 칸 색 = ${data.withTeams ? "팀(팀 미정은 남색)" : "작업"} · 옅은 칸·✓ = 완료 · 빨간 굵은 테두리·! = 계획보다 늦음 · 빗금 = 앞 작업과 겹침${
      data.steps.some((s) => s.forecastSpan) ? " · 점선 칸 = 예상(늦어진 만큼 밀림)" : ""
    }`,
  ]);
  if (data.withTeams && data.legendTeams.length > 0) {
    for (const t of data.legendTeams) {
      const color = teamColor(t.color);
      const row = chart.addRow(["", t.name]);
      row.getCell(2).fill = fill(argbOf(color.hex));
      row.getCell(2).font = { bold: true, color: { argb: argbOf(color.ink) } };
    }
  }
  chart.getColumn(1).width = 6;
  chart.getColumn(2).width = 34;
  for (let c = 0; c < cols.length; c++) chart.getColumn(c + 3).width = data.unit === "day" ? 6 : 4;

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}

export async function downloadToolChecklistXlsx(
  filename: string,
  title: string,
  metaLine: string,
  groups: { label: string; items: { tool_name: string; quantity: string }[] }[],
  memo?: string | null
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

  if (memo && memo.trim() !== "") {
    ws.addRow([]);
    const memoLabelRow = ws.addRow(["메모"]);
    memoLabelRow.font = { bold: true, size: 11, color: { argb: "FF334155" } };
    for (const line of memo.split("\n")) {
      ws.addRow([line]);
    }
  }

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
    ws.addImage(imageId, { tl: { col: 0.15, row: 0.05 }, ext: { width: 162, height: 106 } });
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

type UsageStatementExportItem =
  | {
      kind: "entry";
      use_date: string;
      siteName: string;
      name: string;
      monthlyCount: number;
      residentId: string;
      phone: string;
      dailyWage: number | null;
      note: string;
    }
  | { kind: "subtotal"; label: string; amount: number }
  | { kind: "gap" };

// 세무사 제출용 일용직 사용내역서 — 화면과 같은 근로자별 연속일 소계/빈 줄 구조를 그대로 재현하고,
// 월 누적 사용일수가 한도를 넘긴 칸은 빨간 글씨로 표시한다.
export async function downloadDailyWorkerUsageStatementXlsx(
  filename: string,
  periodLabel: string,
  totalPaid: number,
  items: UsageStatementExportItem[],
  monthlyDayLimit: number
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("일용직 사용내역서");

  const titleRow = ws.addRow([`일용직 사용내역서 — ${periodLabel}`]);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 8);

  const totalRow = ws.addRow([`${periodLabel} 지급액 ${new Intl.NumberFormat("ko-KR").format(totalPaid)}원`]);
  totalRow.font = { bold: true, color: { argb: "FF1E293B" } };
  ws.mergeCells(totalRow.number, 1, totalRow.number, 8);

  const headerRow = ws.addRow(["사용일자", "현장", "이름", "누적일수", "주민번호", "전화번호", "일급", "비고"]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  const headerRowNumber = headerRow.number;

  for (const item of items) {
    if (item.kind === "gap") {
      ws.addRow([]);
      continue;
    }
    if (item.kind === "subtotal") {
      const row = ws.addRow(["", item.label, "", "", "", "", item.amount, ""]);
      row.font = { bold: true };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: "center" };
      });
      continue;
    }
    const row = ws.addRow([
      item.use_date,
      item.siteName,
      item.name,
      `${item.monthlyCount}일째`,
      item.residentId,
      item.phone,
      item.dailyWage ?? "",
      item.note,
    ]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { horizontal: "center" };
    });
    if (item.monthlyCount > monthlyDayLimit) {
      row.getCell(4).font = { bold: true, color: { argb: "FFDC2626" } };
    }
  }

  const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  ws.eachRow((row, rowNumber) => {
    if (rowNumber < headerRowNumber) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
    });
  });

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 16;
  ws.getColumn(6).width = 16;
  ws.getColumn(7).width = 12;
  ws.getColumn(8).width = 20;

  triggerDownload(await wb.xlsx.writeBuffer(), filename);
}
