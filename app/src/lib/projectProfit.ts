import type { CreditPayment } from "@/lib/types";
import { isLedgerVisible } from "@/lib/credit";
import { purchaseCostOf } from "@/lib/vatBasis";

type ProjectAmountRow = { id: string; quote_amount: number | null };

// 프로젝트 하나 + 귀속 하위 프로젝트들을 합친 이익 — 손익보고서(ProjectProfitReport)와 같은 기준.
// 이익금 = 발주액 합계 − 매입(공급가) 합계 − 대행구매 합계, 이익율은 발주액 대비. 발주액이 없으면 null.
export function groupProjectProfit(
  group: ProjectAmountRow[],
  purchaseByProject: Map<string, number>,
  agencyByProject: Map<string, number>
) {
  const quote = group.reduce((s, p) => s + (p.quote_amount ?? 0), 0);
  const purchase = group.reduce((s, p) => s + (purchaseByProject.get(p.id) ?? 0), 0);
  const agency = group.reduce((s, p) => s + (agencyByProject.get(p.id) ?? 0), 0);
  const profit = quote ? quote - purchase - agency : null;
  const rate = quote && profit !== null ? (profit / quote) * 100 : null;
  return { quote, purchase, agency, profit, rate };
}

// 세금계산서를 아직 다 안 끊은 프로젝트의 하반기 예상 이익. 상반기에 이미 끊은 기성금 매출은
// 상반기 확정 이익금(세무사 결산)에 들어가 있으니 발주액에서 빼서 두 번 잡히지 않게 한다.
// 매입도 하반기분만 뺀다(상반기분은 상반기 결산에서 처리됨). 금액은 모두 부가세 제외.
export function unbilledH2Profit(quote: number, h1BilledSales: number, h2Purchase: number, agency: number) {
  return quote - h1BilledSales - h2Purchase - agency;
}

// 여러 프로젝트의 이익 총합 — 발주액이 없는 프로젝트(귀속 하위·미정리·검토중 등)의 매입·대행구매도
// 실제로 나간 돈이라 빠짐없이 뺀다.
export function totalProjectProfit(
  projects: ProjectAmountRow[],
  purchaseByProject: Map<string, number>,
  agencyByProject: Map<string, number>
) {
  return projects.reduce(
    (s, p) => s + (p.quote_amount ?? 0) - (purchaseByProject.get(p.id) ?? 0) - (agencyByProject.get(p.id) ?? 0),
    0
  );
}

// 외상 미정산(완납 전) 매입 — 손익보고서의 매입 합계·이익금에는 빠져 있어서 따로 합산한다. 이익금과 같은
// 기준(공급가, 매입세액 불공제 카테고리는 부가세 포함 — purchaseCostOf). 일부만 갚은 외상도 완납 전까지는
// 거래 전체가 장부에서 빠지므로 거래 전체 금액을 센다.
export function unsettledCreditPurchase(
  rows: (Parameters<typeof isLedgerVisible>[0] & Parameters<typeof purchaseCostOf>[0])[],
  payments: CreditPayment[]
) {
  const unsettled = rows.filter((t) => t.type === "매입" && !isLedgerVisible(t, payments));
  return { count: unsettled.length, cost: unsettled.reduce((s, t) => s + purchaseCostOf(t), 0) };
}
