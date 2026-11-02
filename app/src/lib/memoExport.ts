// 메모 한 장 엑셀(사용자 요청 11/2 "각 메모 하나만 엑셀로 다운", 검사: memoExport.test.ts) — 공사 메모·품질관리 노하우·공구 메모 공통.
// 엑셀은 "항목 | 내용" 두 칸(한 장짜리 문서처럼), 내용 칸은 줄바꿈해서 다 보이게 — 엑셀은 만든 파일의 줄 높이를 알아서 안 늘려서
// 글자 수로 줄 수를 세어 높이를 정하고, 한 칸 최대 높이(409pt)를 넘는 긴 내용은 여러 줄(행)로 나눔.
import { kstDateTime } from "@/lib/kstDate";

export type MemoField = [label: string, value: string];

/** 엑셀 내용 칸 폭(글자 단위 — 영문·숫자 1, 한글 2). */
export const MEMO_VALUE_WIDTH = 70;
/** 엑셀 한 행의 글줄 높이(pt)와 한 행에 넣을 최대 글줄 수(409pt 한도 안). */
export const MEMO_LINE_HEIGHT = 15;
export const MEMO_MAX_LINES_PER_ROW = 25;

const unitsOf = (ch: string) => ((ch.codePointAt(0) ?? 0) > 0xff ? 2 : 1);

/** 칸 폭(글자 단위)에서 줄바꿈하면 몇 줄인지 — 빈 줄도 한 줄. */
export function wrappedLineCount(text: string, widthUnits: number): number {
  return text.split(/\r?\n/).reduce((sum, line) => {
    let units = 0;
    for (const ch of line) units += unitsOf(ch);
    return sum + Math.max(1, Math.ceil(units / widthUnits));
  }, 0);
}

/**
 * 긴 내용을 행 여러 개로 나눔 — 한 행이 maxLines 글줄을 넘지 않게 문단(줄바꿈) 단위로 모으고, 한 문단이 그보다 길면 글자로 자름
 * (자른 곳은 다음 행에 이어짐). 조각을 차례로 읽으면 원래 내용 그대로 — 빠지거나 겹치는 글자 없음.
 */
export function chunkForRows(text: string, widthUnits: number, maxLines: number): string[] {
  const maxUnits = widthUnits * maxLines;
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLines = 0;
  const flush = () => {
    if (current.length) chunks.push(current.join("\n"));
    current = [];
    currentLines = 0;
  };
  for (const paragraph of text.split(/\r?\n/)) {
    const lines = wrappedLineCount(paragraph, widthUnits);
    if (lines > maxLines) {
      // 한 문단이 한 행보다 길면 앞 조각을 끊고 이 문단을 글자 단위로 자름
      flush();
      let piece = "";
      let units = 0;
      for (const ch of paragraph) {
        if (units + unitsOf(ch) > maxUnits) {
          chunks.push(piece);
          piece = "";
          units = 0;
        }
        piece += ch;
        units += unitsOf(ch);
      }
      if (piece) {
        current = [piece];
        currentLines = wrappedLineCount(piece, widthUnits);
      }
      continue;
    }
    if (currentLines + lines > maxLines) flush();
    current.push(paragraph);
    currentLines += lines;
  }
  flush();
  return chunks.length ? chunks : [""];
}

/** 파일 이름에 못 쓰는 글자(\/:*?"<>| 등)를 빼고 너무 길면 자름. */
export function safeFileNamePart(s: string, max = 40): string {
  const cleaned = s.replace(/[\\/:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const chars = [...cleaned];
  return chars.length > max ? chars.slice(0, max).join("").trim() : cleaned;
}

/** "공사메모_2026-10-10_현장_프로젝트.xlsx"처럼 — 빈 조각은 뺌. */
export function memoFileName(parts: (string | null | undefined)[]): string {
  const name = parts.map((p) => safeFileNamePart(p ?? "")).filter(Boolean).join("_");
  return `${name || "메모"}.xlsx`;
}

/** 한국 시각 날짜(YYYY-MM-DD) — 저장 시각은 UTC라 앞 10글자를 그대로 쓰면 오전 9시 전에 쓴 메모가 전날로 보임. */
export const kstDate = (iso: string | null | undefined) => kstDateTime(iso).slice(0, 10);

export type ConstructionMemoForExport = {
  created_at: string;
  updated_at: string;
  site_name: string;
  project_name: string;
  content: string;
};

export function constructionMemoFields(m: ConstructionMemoForExport): MemoField[] {
  const fields: MemoField[] = [["작성", kstDateTime(m.created_at)]];
  if (m.updated_at && m.updated_at !== m.created_at) fields.push(["수정", kstDateTime(m.updated_at)]);
  fields.push(["현장", m.site_name], ["프로젝트", m.project_name], ["내용", m.content]);
  return fields;
}

export function constructionMemoFileName(m: ConstructionMemoForExport): string {
  return memoFileName(["공사메모", kstDate(m.created_at), m.site_name, m.project_name]);
}

export type KnowHowNoteForExport = { title: string; created_at: string; content: string | null; memo: string | null };

export function knowHowFields(n: KnowHowNoteForExport): MemoField[] {
  return [
    ["제목", n.title],
    ["작성", kstDateTime(n.created_at)],
    ["내용", n.content ?? ""],
    ["메모", n.memo ?? ""],
  ];
}

export function knowHowFileName(sectionTitle: string, n: KnowHowNoteForExport): string {
  return memoFileName([sectionTitle.replace(/\s+/g, ""), kstDate(n.created_at), n.title]);
}
