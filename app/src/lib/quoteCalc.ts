/** 품목 금액에 핸들링 fee(%)를 반영한 확정금액 — 100원 단위 반올림. */
export function computeConfirmedAmount(amount: number, handlingFeePct: number): number {
  const raw = amount * (1 + handlingFeePct / 100);
  return Math.round(raw / 100) * 100;
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
