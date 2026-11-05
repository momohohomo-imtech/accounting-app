// 공구명세서 이름칸의 대괄호 [ ] = 반입반출증에는 안 나오는 메모(사용자 요청 11/5 — 스페너처럼 여러 종류를 챙길 때 "스페너 [13·17·19mm]"로
// 적으면 공구명세서 화면·인쇄·엑셀에는 이름 아래 [ ]까지 보이고, 화성·동희 반입반출증(화면 미리보기·인쇄·엑셀)에는 "스페너"만).
// DB 변경 없음 — 이름은 적은 그대로 저장하고 보여 줄 때만 나눔. 검사: toolNameNote.test.ts
const BRACKET = /\[([^[\]]*)\]/g;

/**
 * 이름을 반입반출증용(괄호 밖, printName)과 메모(괄호 안)로 나눔. 괄호가 없으면 그대로(앞뒤 공백만 정리). 짝이 안 맞는 "["는 그냥 글자로 둠.
 * 괄호만 있어 괄호 밖 이름이 비면 괄호 기호만 뺀 글자를 printName으로(반입반출증에 빈 줄이 생기지 않게).
 */
export function splitToolNameNote(name: string | null | undefined): { printName: string; notes: string[] } {
  const raw = name ?? "";
  const notes: string[] = [];
  let rest = raw;
  let found = false;
  // 겹친 괄호("[a [b] c]")는 안쪽부터 벗김
  for (let i = 0; i < 10; i++) {
    let hit = false;
    rest = rest.replace(BRACKET, (_m, inner: string) => {
      hit = true;
      const text = inner.replace(/\s+/g, " ").trim();
      if (text) notes.push(text);
      return " ";
    });
    if (!hit) break;
    found = true;
  }
  if (!found) return { printName: raw.trim(), notes };
  const printName = rest.replace(/\s+/g, " ").trim();
  return { printName: printName || raw.replace(/[[\]]/g, " ").replace(/\s+/g, " ").trim(), notes };
}

/** 화성·동희 반입반출증(화면·인쇄·엑셀)에 쓰는 이름("스페너 [13·17·19mm]" → "스페너") */
export function printToolName(name: string | null | undefined): string {
  return splitToolNameNote(name).printName;
}

/** 작성 화면 이름칸 기본값 — 괄호가 없으면 끝에 빈 [ ]를 붙여 둠(사용자 요청 11/5 "모든 항에 [ ] 기본 배치"). 이미 괄호가 있거나 빈 이름이면 그대로 */
export function withEmptyBracket(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n || /[[\]]/.test(n)) return n;
  return `${n} [ ]`;
}

/** 저장·요약 표시용 — 안에 적은 게 없는 [ ]는 지움(그대로 두면 이름만 예전처럼 저장). 앞뒤 공백 정리, 다른 글자·띄어쓰기는 그대로 */
export function stripEmptyBrackets(name: string | null | undefined): string {
  return (name ?? "").replace(/\s*\[\s*\]/g, "").trim();
}
