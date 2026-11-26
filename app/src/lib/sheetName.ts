// 엑셀 장 이름 다듬기 — 엑셀(exceljs)은 장 이름에 * ? : \ / [ ] 가 있거나, 앞뒤가 작은따옴표거나, 비었거나, "History"면 오류를 냄.
// 거래처·카테고리 이름을 장 이름에 쓰는 엑셀(보고서 거래처 내역 등)은 이름에 "/"가 있으면 엑셀 받기가 아무 말 없이 안 됐음.
// 31자(엑셀 한도)를 넘으면 자름(한글은 한 글자 = 1자, 이모지처럼 두 칸짜리 글자는 반으로 자르지 않음). 검사: sheetName.test.ts

export const SHEET_NAME_MAX = 31;

export function safeSheetName(name: string): string {
  const cleaned = String(name ?? "")
    .replace(/[*?:/\\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let out = "";
  for (const ch of cleaned) {
    if (out.length + ch.length > SHEET_NAME_MAX) break;
    out += ch;
  }
  out = out.replace(/^'+/, "").replace(/'+$/, "").trim();
  if (!out) return "Sheet1";
  return out === "History" ? "History 1" : out;
}
