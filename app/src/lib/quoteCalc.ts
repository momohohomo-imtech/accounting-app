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
