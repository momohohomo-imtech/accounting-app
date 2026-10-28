import { isLedgerVisible, remainingBalance, transactionTotal } from "@/lib/credit";
import { salesSupplyOf, type VatBasisRow } from "@/lib/vatBasis";
import { activeGroups, sumByProject, type OutlookProject } from "@/lib/projectProfit";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";
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

// 프로젝트별 발행한 매출 계산서(공급가액) — 입금과 상관없이 전부(외상 미정산 포함). 미수 금액을 입금 대기·계산서 미발행으로
// 나눌 때 씀.
export function billedSalesByProject(rows: ProjectSalesRow[]) {
  const billed = new Map<string, number>();
  for (const t of rows) {
    if (t.type !== "매출" || !t.project_id) continue;
    billed.set(t.project_id, (billed.get(t.project_id) ?? 0) + salesSupplyOf(t));
  }
  return billed;
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

// 받을 금액이 있는 상태 — 대시보드 수금 예정액과 같음(검토중은 수주 전, 수금 완료·기타는 받을 것 없음).
export const RECEIVABLE_STATUSES = ["ongoing", "done", PROJECT_STATUS_AWAITING_PAYMENT] as const;

// 미수 금액(받을 금액) — 프로젝트 목록 미수 금액 칸·묶음 요약 줄, 프로젝트 보고서 남은 금액, 보고서 메뉴 프로젝트별 손익·프로젝트
// 요약이 같이 씀. 대시보드 수금 예정액과 같은 단위·상태(activeGroups — 진행중·공사 완료·완료 수금대기, 어미 + "타 프로젝트 귀속"
// 하위가 한 단위, 자기 상태가 있는 하위는 따로)마다 수주예상액 − 받은 매출(0 아래로 안 내려감)을 더함. 그런 단위가 없으면(검토중·
// 수금 완료·타 프로젝트 귀속 하위 하나만 등) null. billedByProject를 주면 입금 대기(계산서 발행 후 아직 다 못 받은 것)와 계산서
// 미발행(수주예상액 − 발행한 계산서)으로 나눠 줌. quote = 그 단위들의 발주액 합(0이면 화면에서 "발주액 미입력").
export function receivableOf(
  projects: OutlookProject[],
  agencyByProject: Map<string, number>,
  receivedByProject: Map<string, number>,
  billedByProject?: Map<string, number>
) {
  const units = activeGroups(projects, RECEIVABLE_STATUSES);
  if (units.length === 0) return null;
  let amount = 0;
  let waiting = 0;
  let unbilled = 0;
  for (const u of units) {
    const agency = sumByProject(u.members, agencyByProject);
    const received = sumByProject(u.members, receivedByProject);
    amount += remainingReceivable(u.quote, agency, received);
    if (billedByProject) {
      const billed = sumByProject(u.members, billedByProject);
      waiting += billed - received;
      unbilled += Math.max(0, u.quote - agency - billed);
    }
  }
  return { amount, waiting, unbilled, count: units.length, quote: units.reduce((s, u) => s + u.quote, 0) };
}

// 프로젝트 보고서 "받은 돈 내역" — 보고서에 합친 프로젝트들의 매출 계산서(선급금·중도금·잔금·기성금)마다 받은 상태.
// received(요약) = 즉시결제·정산 끝난 외상 계산서의 공급가액(일부만 받은 외상은 다 받을 때까지 안 넣음 — 대시보드와 같은 기준),
// 남은 금액은 receivableOf로. 줄마다 received는 실제로 들어온 돈(부가세 포함, 일부 입금 포함), paidDate는 즉시결제면 계산서
// 날짜·외상이면 마지막 정산일.
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
  return {
    lines,
    expected: quote - agency,
    billed: lines.reduce((s, l) => s + l.supply, 0),
    received: lines.filter((l) => l.status === "received").reduce((s, l) => s + l.supply, 0),
    receivedActual: lines.reduce((s, l) => s + l.received, 0),
  };
}
