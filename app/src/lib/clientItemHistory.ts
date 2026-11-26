// 거래 등록 "품목" 칸 — 고른 거래처에서 예전에 쓴 품목만 골라 쓰기(11/26 사용자 요청 "거래처 선택 후 품목 쓸 때 그 거래처 건에 한해 이전
// 이력 자동 쓰기"). 조회는 lib/actions/clientItemHistory.ts(최근 3년·최근 500줄), 여기선 같은 품목을 하나로 묶어 최근에 쓴 순으로.
// 금액은 자동으로 넣지 않음(돈 칸은 직접 — 고르기 목록에 지난번 단가만 같이 보여 줌). 검사: clientItemHistory.test.ts

export type ClientItemRow = {
  item_name: string | null;
  trans_date: string;
  created_at?: string | null;
  unit_price?: number | null;
};

export type ClientItemSuggestion = {
  /** 품목 이름(가장 최근에 적은 그대로) */
  name: string;
  /** 마지막으로 쓴 거래일 */
  lastDate: string;
  /** 쓴 횟수(조회한 기간 안) */
  count: number;
  /** 가장 최근에 적은 단가(없으면 null) */
  unitPrice: number | null;
};

export const CLIENT_ITEM_SUGGESTION_LIMIT = 40;

/** 같은 품목으로 볼 열쇠 — 앞뒤·여러 칸 띄어쓰기와 영문 대소문자만 무시 */
export function itemKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko");
}

const newerFirst = (a: ClientItemRow, b: ClientItemRow) =>
  b.trans_date.localeCompare(a.trans_date) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));

export function clientItemSuggestions(rows: ClientItemRow[], limit = CLIENT_ITEM_SUGGESTION_LIMIT): ClientItemSuggestion[] {
  const byKey = new Map<string, ClientItemSuggestion>();
  for (const r of [...rows].sort(newerFirst)) {
    const name = (r.item_name ?? "").trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = itemKey(name);
    const found = byKey.get(key);
    if (found) {
      found.count += 1;
      if (found.unitPrice === null && r.unit_price != null) found.unitPrice = Number(r.unit_price);
      continue;
    }
    byKey.set(key, { name, lastDate: r.trans_date, count: 1, unitPrice: r.unit_price != null ? Number(r.unit_price) : null });
  }
  return [...byKey.values()].slice(0, limit);
}

/** 고르기 목록 옆 글자 — "11/20 · 3번 · 단가 5,000원" */
export function suggestionLabel(s: ClientItemSuggestion): string {
  const [, m, d] = s.lastDate.split("-");
  const parts = [`${Number(m)}/${Number(d)}`, `${s.count}번`];
  if (s.unitPrice != null) parts.push(`단가 ${s.unitPrice.toLocaleString("ko-KR")}원`);
  return parts.join(" · ");
}
