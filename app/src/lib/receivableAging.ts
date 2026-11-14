// 오래된 외상매출금(10/31 사용자 "전부" — 추천 기능): 세금계산서(거래일)부터 오늘(한국 날짜)까지 지난 날 수로 나눔.
// 남은 금액은 외상 잔액(lib/credit.ts remainingBalance)을 넘겨받음 — 대시보드 외상매출금 합계와 같은 기준(검사: receivableAging.test.ts).
export const AGING_BUCKETS = [
  { key: "d30", label: "30일 이내", maxDays: 30 },
  { key: "d60", label: "31~60일", maxDays: 60 },
  { key: "d90", label: "61~90일", maxDays: 90 },
  { key: "over90", label: "90일 초과", maxDays: Infinity },
] as const;

export type AgingInput = { id: string; trans_date: string; client: string; item: string | null; amount: number };
export type AgingItem = AgingInput & { days: number };

const dayNumber = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;

export function receivableAging(inputs: AgingInput[], todayYmd: string) {
  // 잔액이 남은 것 전부 — 마이너스 잔액(매출 할인·단수 조정 줄, 11/14)도 넣어야 구간 합계가 외상매출금 합계와 맞음(예전엔 0보다
  // 큰 것만 넣어서 마이너스 줄이 있으면 합계보다 크게 나왔음).
  const items: AgingItem[] = inputs
    .filter((r) => r.amount !== 0)
    .map((r) => ({ ...r, days: Math.max(0, dayNumber(todayYmd) - dayNumber(r.trans_date)) }))
    .sort((a, b) => b.days - a.days || b.amount - a.amount);
  const buckets = AGING_BUCKETS.map((b, i) => {
    const min = i === 0 ? -Infinity : AGING_BUCKETS[i - 1].maxDays;
    const inBucket = items.filter((it) => it.days > min && it.days <= b.maxDays);
    return { key: b.key, label: b.label, count: inBucket.length, amount: inBucket.reduce((s, it) => s + it.amount, 0) };
  });
  return { items, buckets, over60: items.filter((it) => it.days > 60) };
}
