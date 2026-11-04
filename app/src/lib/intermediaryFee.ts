// 중간 업체 수수료 — 원청 발주를 중간 업체(현대기계)가 받아 발주액의 20%를 가져가고 구매대행도 그 업체가 하는 계약 구조(11/4 사용자
// 설명, 내후년부터는 원청과 직접 계약 예정). 사용자는 대행구매 목록에 거래처 "현대기계"·카테고리 "현대"로 발주액의 20%를 한 줄 넣어
// 공제로 씀 — 프로젝트 보고서 대행구매 목록의 "+ 현대 수수료 20% 추가" 버튼이 그 줄을 만들어 줌(DB 변경 없음). 검사: intermediaryFee.test.ts.
export const INTERMEDIARY_FEE = {
  pct: 20,
  clientName: "현대기계",
  categoryName: "현대",
  itemName: "현대 수수료 20%",
} as const;

/** 발주액의 수수료(원 단위 반올림) — 발주액이 없으면 0 */
export function intermediaryFeeAmount(quote: number | null | undefined, pct: number = INTERMEDIARY_FEE.pct) {
  return Math.round(((Number(quote) || 0) * pct) / 100);
}

/** 이미 있는 수수료 줄 — 거래처에 "현대"가 들어가고 품목에 "수수료"가 들어간 대행구매 줄(버튼으로 만든 줄 포함) */
export function intermediaryFeeRows<T extends { client_name: string | null; item_name: string | null }>(items: T[]) {
  return items.filter((i) => (i.client_name ?? "").includes("현대") && (i.item_name ?? "").includes("수수료"));
}
