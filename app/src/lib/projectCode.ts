// 프로젝트 번호("2026-001", 097 SQL부터 1,000번째는 "2026-1000") 비교 — 연도·순번을 숫자로 봐서 최근 번호가 먼저(글자로
// 비교하면 "2026-1000"이 "2026-999"보다 앞에 오고, 순번만 보면 작년 번호 "2025-045"가 올해 "2026-003"보다 위로 감).
// 번호가 없으면 맨 뒤. 검사: projectCode.test.ts.
function codeKey(code: string | null | undefined): [number, number] | null {
  const full = code?.match(/^(\d{4})-(\d+)$/);
  if (full) return [Number(full[1]), Number(full[2])];
  const tail = code?.match(/(\d+)$/);
  return tail ? [0, Number(tail[1])] : null;
}

export function compareProjectCodeDesc(a: string | null | undefined, b: string | null | undefined) {
  const ka = codeKey(a);
  const kb = codeKey(b);
  if (!ka || !kb) return ka ? -1 : kb ? 1 : 0;
  return kb[0] - ka[0] || kb[1] - ka[1];
}
