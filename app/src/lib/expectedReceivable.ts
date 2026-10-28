import { isLedgerVisible, remainingBalance, transactionTotal } from "@/lib/credit";
import { salesSupplyOf, type VatBasisRow } from "@/lib/vatBasis";
import { activeGroups, sumByProject, type OutlookProject } from "@/lib/projectProfit";
import type { CreditPayment } from "@/lib/types";

type ProjectSalesRow = VatBasisRow & { id: string; payment_type: string; project_id: string | null };

// 프로젝트별 이미 받은 매출(기성금 등) — 현금·이체 매출 + 정산 끝난 외상 매출의 부가세 제외 공급가액.
// 외상 정산은 금액과 상관없이 건 전체를 받은 것으로 처리하므로, 어음 할인으로 실제 입금액이
// 적어도 계산서 금액 전체가 받은 것으로 잡힌다(할인료는 미수가 아니라 비용).
export function receivedSalesByProject(rows: ProjectSalesRow[], payments: CreditPayment[]) {
  const received = new Map<string, number>();
  for (const t of rows) {
    if (t.type !== "매출" || !t.project_id || !isLedgerVisible(t, payments)) continue;
    received.set(t.project_id, (received.get(t.project_id) ?? 0) + salesSupplyOf(t));
  }
  return received;
}

// 프로젝트 하나의 남은 받을 금액 = 수주예상액(발주액 − 대행구매액) − 이미 받은 매출.
// 계산서 합계가 수주예상액과 딱 맞지 않을 수 있어(기타 공제 등) 0 아래로는 안 내려감.
export function remainingReceivable(quoteAmount: number | null, agencyTotal: number, receivedSupply: number) {
  return Math.max(0, (quoteAmount ?? 0) - agencyTotal - receivedSupply);
}

// 대시보드 수금 예정액 — 상태(진행중·공사 완료·완료 수금대기)별 남은 받을 금액. 어미 + 귀속 하위는 한 묶음("타 프로젝트 귀속"
// 하위는 어미 상태): 묶음 수주예상액(발주액 − 대행구매액) − 묶음에서 이미 받은 매출 — 하위로 받은 기성금도 어미 발주액에서
// 빠지고 하위 발주액도 들어간다(lib/projectProfit.ts의 activeGroups, 1월 부가세 미발행 예상분과 같은 단위). 묶음은 대표(어미)
// 상태 칸에 한 건.
export function expectedReceivableByStatus(
  projects: OutlookProject[],
  statuses: readonly string[],
  agencyByProject: Map<string, number>,
  receivedByProject: Map<string, number>
) {
  const groups = activeGroups(projects, statuses);
  return statuses.map((status) => {
    const rows = groups.filter((g) => g.status === status);
    return {
      status,
      count: rows.length,
      amount: rows.reduce(
        (s, g) =>
          s +
          remainingReceivable(g.quote, sumByProject(g.members, agencyByProject), sumByProject(g.members, receivedByProject)),
        0
      ),
      received: rows.reduce((s, g) => s + sumByProject(g.members, receivedByProject), 0),
    };
  });
}

// 프로젝트 보고서 "받은 돈" — 보고서에 합친 프로젝트들의 매출 계산서(선급금·중도금·잔금·기성금)마다 받은 상태와 요약.
// 요약은 대시보드 수금 예정액·연말 점검과 같은 기준(공급가액): 받은 금액 = 즉시결제·정산 끝난 외상 계산서(일부만 받은 외상은 다
// 받을 때까지 안 넣음), 남은 금액 = 수주예상액(발주액 − 대행구매액) − 받은 금액(0 아래로 안 내려감) = 입금 대기 + 계산서 미발행.
// 줄마다 received는 실제로 들어온 돈(부가세 포함, 일부 입금 포함), paidDate는 즉시결제면 계산서 날짜·외상이면 마지막 정산일.
export type ReceiptStatus = "received" | "partial" | "waiting";

export function projectReceipts<T extends ProjectSalesRow & { trans_date: string }>(
  rows: T[],
  payments: CreditPayment[],
  quote: number,
  agency: number
) {
  const lines = rows
    .filter((t) => t.type === "매출")
    .map((t) => {
      const total = transactionTotal(t);
      const done = isLedgerVisible(t, payments);
      const left = done ? 0 : remainingBalance(t, payments);
      const status: ReceiptStatus = done ? "received" : left < total ? "partial" : "waiting";
      const lastPaid = payments
        .filter((p) => p.transaction_id === t.id)
        .map((p) => p.paid_date)
        .sort()
        .at(-1);
      return {
        row: t,
        total,
        supply: salesSupplyOf(t),
        received: total - left,
        status,
        paidDate: t.payment_type === "credit" ? lastPaid ?? null : t.trans_date,
      };
    });
  const expected = quote - agency;
  const billed = lines.reduce((s, l) => s + l.supply, 0);
  const received = lines.filter((l) => l.status === "received").reduce((s, l) => s + l.supply, 0);
  return {
    lines,
    expected,
    billed,
    received,
    receivedActual: lines.reduce((s, l) => s + l.received, 0),
    waiting: billed - received,
    unbilled: Math.max(0, expected - billed),
    remaining: remainingReceivable(quote, agency, received),
  };
}
