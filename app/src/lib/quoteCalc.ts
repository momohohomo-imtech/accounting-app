/** 품목 금액에 핸들링 fee(%)를 반영한 확정금액 — 100원 단위 반올림. */
export function computeConfirmedAmount(amount: number, handlingFeePct: number): number {
  const raw = amount * (1 + handlingFeePct / 100);
  return Math.round(raw / 100) * 100;
}

type QuoteLine = {
  amount: number | null;
  unit_price: number | null;
  quantity: number | null;
  handling_fee_pct: number | null;
};

/**
 * 견적 한 줄의 인쇄용 단가·금액(핸들링 fee 반영, 100원 단위). 금액이 "수량 × 단가"로 채워진 줄은
 * 금액 = (100원 단위로 맞춘 단가) × 수량 — 인쇄된 단가 × 수량이 금액과 항상 맞게.
 * 금액을 직접 고쳐 적은 줄(할인·일괄 금액 등)은 예전처럼 적은 금액 기준으로 계산한다.
 * 작성 화면·목록 합계·인쇄·엑셀이 모두 이 함수 하나를 쓴다.
 */
export function quoteLineAmounts(it: QuoteLine): { adjustedUnitPrice: number | null; confirmed: number } {
  const fee = it.handling_fee_pct ?? 0;
  const amount = it.amount ?? 0;
  const adjustedUnitPrice = it.unit_price != null ? computeConfirmedAmount(it.unit_price, fee) : null;
  const isQtyTimesPrice =
    adjustedUnitPrice != null && it.unit_price != null && !!it.quantity && Math.abs(amount - it.quantity * it.unit_price) < 0.5;
  const confirmed = isQtyTimesPrice ? Math.round(adjustedUnitPrice * it.quantity!) : computeConfirmedAmount(amount, fee);
  return { adjustedUnitPrice, confirmed };
}

/** 부가세 포함 금액을 공급가액/세액으로 분리 (부가세 10% 가정). */
export function splitVat(amountInclusive: number): { supply: number; vat: number } {
  const supply = Math.round(amountInclusive / 1.1);
  return { supply, vat: amountInclusive - supply };
}

/**
 * 묶음(그룹) 처리된 품목 중 실제로 견적서(인쇄/엑셀/PDF)에 보여야 하는 행만 통과시킴 —
 * 묶이지 않은 일반 항목이거나, 묶음의 대표(합산) 행만 해당. 묶인 원본 항목은
 * 작성 화면에서만 보이고 여기서 걸러짐.
 */
export function isVisibleQuoteItem(item: { group_label?: string | null; is_group_summary?: boolean }): boolean {
  return !item.group_label || Boolean(item.is_group_summary);
}
