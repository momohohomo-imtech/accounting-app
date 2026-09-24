import { isLedgerVisible } from "@/lib/credit";
import { salesSupplyOf, type VatBasisRow } from "@/lib/vatBasis";
import type { CreditPayment } from "@/lib/types";

type ProjectSalesRow = VatBasisRow & { id: string; payment_type: string; project_id: string };

// 프로젝트별 이미 받은 매출(기성금 등) — 현금·이체 매출 + 정산 끝난 외상 매출의 부가세 제외 공급가액.
// 외상 정산은 금액과 상관없이 건 전체를 받은 것으로 처리하므로, 어음 할인으로 실제 입금액이
// 적어도 계산서 금액 전체가 받은 것으로 잡힌다(할인료는 미수가 아니라 비용).
export function receivedSalesByProject(rows: ProjectSalesRow[], payments: CreditPayment[]) {
  const received = new Map<string, number>();
  for (const t of rows) {
    if (t.type !== "매출" || !isLedgerVisible(t, payments)) continue;
    received.set(t.project_id, (received.get(t.project_id) ?? 0) + salesSupplyOf(t));
  }
  return received;
}

// 프로젝트 하나의 남은 받을 금액 = 수주예상액(발주액 − 대행구매액) − 이미 받은 매출.
// 계산서 합계가 수주예상액과 딱 맞지 않을 수 있어(기타 공제 등) 0 아래로는 안 내려감.
export function remainingReceivable(quoteAmount: number | null, agencyTotal: number, receivedSupply: number) {
  return Math.max(0, (quoteAmount ?? 0) - agencyTotal - receivedSupply);
}
