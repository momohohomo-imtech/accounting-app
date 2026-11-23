// 매입매출 등록 "여러 날짜에 같은 내용으로"(사용자 요청 11/23 "매입장에 한 번에 여러 날짜를 선택해서 한 번에 여러 건(내용은 동일)") —
// 달력에서 고른 날짜마다 같은 줄(품목·금액·거래처…)을 한 번에 넣음. 날짜 고르기·줄 만들기·확인 문구만 여기서(화면 없이 계산만).
// 검사: multiDate.test.ts

/** 한 번에 고를 수 있는 날짜 수 — 실수로 몇 달치를 누르지 않게(두 달치) */
export const MAX_MULTI_DATES = 62;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 날짜를 누르면 넣거나 빼기 — 늘 날짜 순·한 번만 */
export function toggleDate(dates: readonly string[], date: string): string[] {
  if (!DATE_RE.test(date)) return [...dates];
  const set = new Set(dates);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return [...set].sort();
}

/** 고른 날짜마다 같은 줄들 — 날짜 순, 한 날짜 안은 줄 순서 그대로 */
export function multiDateRows<I, R>(dates: readonly string[], items: readonly I[], build: (item: I, date: string) => R): R[] {
  return [...new Set(dates)].filter((d) => DATE_RE.test(d)).sort().flatMap((date) => items.map((item) => build(item, date)));
}

/**
 * "한 결제로 묶기"를 날짜마다 — 같은 날짜에 줄이 2개 이상이면 그 날짜 줄끼리 같은 묶음 번호(날짜가 다르면 다른 결제).
 * 줄이 하나뿐인 날짜는 묶지 않음. makeId: 묶음 번호 만들기(서버는 crypto.randomUUID).
 */
export function groupIdsPerDate(rows: readonly { trans_date: string }[], makeId: () => string): Map<string, string> {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.trans_date, (counts.get(r.trans_date) ?? 0) + 1);
  const ids = new Map<string, string>();
  for (const [date, n] of counts) if (n > 1) ids.set(date, makeId());
  return ids;
}

const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 확인창·화면에 보일 날짜 글자 — "11/3, 11/5, 11/12"(해가 둘 이상이면 연도도), 많으면 앞 12개 + "외 N일" */
export function multiDateLabel(dates: readonly string[], limit = 12): string {
  const sorted = [...new Set(dates)].sort();
  const years = new Set(sorted.map((d) => d.slice(0, 4)));
  const fmt = (d: string) => (years.size > 1 ? `${d.slice(0, 4)}.${short(d)}` : short(d));
  const shown = sorted.slice(0, limit).map(fmt).join(", ");
  return sorted.length > limit ? `${shown} 외 ${sorted.length - limit}일` : shown;
}
