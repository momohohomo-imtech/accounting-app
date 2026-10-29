import type { CreditPayment } from "@/lib/types";
import { isLedgerVisible } from "@/lib/credit";
import { purchaseCostOf, salesSupplyOf, type VatBasisRow } from "@/lib/vatBasis";
import { one } from "@/lib/relations";
import { PAYROLL_CATEGORY_NAME } from "@/lib/vatExempt";
import { PROJECT_STATUS_AWAITING_PAYMENT, PROJECT_STATUS_MERGED, PROJECT_STATUS_REVIEW } from "@/lib/projectStatus";

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

// 세금계산서를 아직 다 안 끊은 프로젝트의 하반기 예상 이익. 하반기 매출 = 발주액 − 대행구매 − 하반기 전에 이미 끊은 매출
// (상반기분은 상반기 확정 이익금(세무사 결산)에, 작년까지 끊은 것은 그 해 이익에 들어가 있어 두 번 잡히지 않게), 단 하반기에
// 실제로 끊은 매출이 더 크면 그 금액 — 추가공사분을 발주액에 안 고치고 계산서를 더 끊은 경우(예전엔 발주액에서 멈춰 이익이 적게
// 잡혔고, 하반기 전에 이미 발주액보다 더 끊었으면 음수가 돼서 하반기 예상이 더 깎였음). 매입은 하반기분만(상반기분은 상반기
// 결산에서 처리됨). 금액은 모두 부가세 제외.
export function unbilledH2Profit(quote: number, billedBefore: number, h2Purchase: number, agency: number, h2Billed = 0) {
  return Math.max(quote - agency - billedBefore, h2Billed) - h2Purchase;
}

// 묶음 매출(공급가) — 발주액(검토중 제외) − 대행구매액, 실제로 끊은 매출이 더 크면 그 금액(발주액보다 계산서를 더 끊은 경우),
// 발주액이 없으면(빈칸·0원·검토중) 실제로 끊은 매출. 대행구매는 발주처가 직접 사는 몫이라 우리 매출·매입이 아님 — 발주액에서만
// 빼고(실제 매출에는 처음부터 없음) 비용으로 또 빼지 않음.
export function groupRevenue(quote: number, agency: number, actualSales: number) {
  return quote > 0 ? Math.max(quote - agency, actualSales) : actualSales;
}

// ── 대시보드 "프로젝트 기준 예상 이익"·"연간 예상 이익(확정+예상)", 보고서 "예상 순이익율" 공통 계산 ──
// 거래는 세금계산서(거래일) 기준 — 외상 미정산도 포함한다. 종합소득세는 계산서 기준이라, 받은 계산서인데 아직 안 갚은
// 매입은 비용, 끊었는데 아직 못 받은 매출은 매출(부가세 분기표와 같은 기준). 예전엔 정산 전 외상이 빠져 이익이 틀어졌음.

type OutlookCategory = { name: string; vat_exempt?: boolean | null; vat_non_deductible?: boolean | null };
export type OutlookProject = {
  id: string;
  name?: string;
  status: string | null;
  quote_amount: number | null;
  parent_project_id?: string | null;
};
export type OutlookTx = VatBasisRow & {
  type: string;
  project_id: string | null;
  trans_date: string;
  expense_categories?: OutlookCategory | OutlookCategory[] | null;
};

const isPayroll = (t: OutlookTx) => one(t.expense_categories)?.name === PAYROLL_CATEGORY_NAME;

// 합계 계산에 넣는 발주액 — 검토중(아직 수주 전)은 0(사용자 요청: 검토중은 계산에 넣지 않음).
export function countedQuote(p: Pick<OutlookProject, "status" | "quote_amount">) {
  return p.status === PROJECT_STATUS_REVIEW ? 0 : p.quote_amount ?? 0;
}

// ── 어미 + 귀속 하위 묶음 ──
// 맨 위 어미 — 귀속은 한 단계지만(새로 지정은 막음) 예전에 3단(어미 ← 하위 ← 하위의 하위)으로 저장된 자료는 맨 위 어미
// 묶음으로(프로젝트 목록 표·손익보고서와 같은 기준 — 예전엔 가운데 하위가 따로 묶음이 돼 화면마다 숫자가 달랐음). 목록(byId)에
// 있는 조상까지만 올라가고, 서로를 가리키는 잘못된 자료는 묶지 않음(자기 자신).
export function topProjectOf<P extends { id: string; parent_project_id?: string | null }>(p: P, byId: Map<string, P>): P {
  let top = p;
  const seen = new Set([p.id]);
  for (let parentId = p.parent_project_id; parentId; ) {
    const parent = byId.get(parentId);
    if (!parent) break;
    if (seen.has(parent.id)) return p;
    seen.add(parent.id);
    top = parent;
    parentId = parent.parent_project_id;
  }
  return top;
}

// 손익보고서·프로젝트 목록과 같은 묶음: 어미가 같은 목록(그 해 프로젝트)에 있는 하위만 어미 묶음에 들어간다.
export function projectGroups<P extends OutlookProject>(projects: P[]) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const groups = new Map<string, { root: P; members: P[] }>();
  for (const p of projects) {
    const root = topProjectOf(p, byId);
    const group = groups.get(root.id) ?? { root, members: [] };
    group.members.push(p);
    groups.set(root.id, group);
  }
  return Array.from(groups.values());
}

// 묶음 안 "타 프로젝트 귀속" 하위는 어미 상태를 물려받음(프로젝트 목록 상태색과 같은 규칙) — 검토중 어미의 하위 발주액은
// 합계에서 빠지고, 진행중 어미의 하위는 미발행·수금 예정 계산에 같이 들어간다.
export function effectiveStatus(p: OutlookProject, root: OutlookProject) {
  return p.id !== root.id && p.status === PROJECT_STATUS_MERGED ? root.status : p.status;
}

export function sumByProject(projects: { id: string }[], amountByProject: Map<string, number>) {
  return projects.reduce((s, p) => s + (amountByProject.get(p.id) ?? 0), 0);
}

// 하반기 미발행 예상·1월 부가세 미발행 예상분·수금 예정액·연말 점검의 계산 단위 중 그 상태들인 것. 단위 = 어미 + "타 프로젝트
// 귀속" 하위(어미 상태) — 발주액·매출·매입·대행구매를 단위 안에서 합쳐서 봐서, 하위에 끊은 매출은 어미 발주액에서 빠지고 하위
// 발주액도 들어간다(예전엔 프로젝트마다 따로라 하위 매출이 두 번 잡히고 귀속 하위 발주액은 빠졌음). 자기 상태가 있는 하위는
// 따로 한 단위(프로젝트 목록 상태와 같게 — 예전엔 진행중 어미 아래 "완료 수금대기" 하위 금액이 진행중 칸으로 들어갔음).
// 대표(상태·이름)는 단위의 맨 앞(어미 단위면 어미). rootId = 묶음 맨 위 어미.
export function activeGroups<P extends OutlookProject>(projects: P[], statuses: readonly string[]) {
  return projectGroups(projects).flatMap(({ root, members }) => {
    const units = new Map<string, P[]>();
    for (const p of members) {
      const unitId = p.id !== root.id && p.status === PROJECT_STATUS_MERGED ? root.id : p.id;
      units.set(unitId, [...(units.get(unitId) ?? []), p]);
    }
    return Array.from(units.entries()).flatMap(([unitId, unit]) => {
      const lead = unit.find((p) => p.id === unitId) ?? unit[0];
      const status = effectiveStatus(lead, root) ?? "";
      if (!statuses.includes(status)) return [];
      const ordered = [lead, ...unit.filter((p) => p !== lead)];
      return [
        {
          rootId: root.id,
          status,
          label: ordered.length > 1 ? `${lead.name ?? ""} 외\u00a0${ordered.length - 1}건` : lead.name ?? "",
          members: ordered,
          quote: ordered.reduce((s, p) => s + (p.quote_amount ?? 0), 0),
        },
      ];
    });
  });
}

// 세금계산서를 아직 다 안 끊었을 수 있는 "미발행" 묶음 — 진행중·공사 완료·완료 수금대기(귀속 하위는 어미 상태)이고 발주액
// 합계가 있는(0원·검토중 제외) 것. 하반기 예상 이익과 1월 부가세 미발행 예상분이 같은 대상을 쓴다.
const UNBILLED_STATUSES = ["ongoing", "done", PROJECT_STATUS_AWAITING_PAYMENT];
function unbilledGroups(projects: OutlookProject[]) {
  return activeGroups(projects, UNBILLED_STATUSES).filter((g) => g.quote > 0);
}

// 프로젝트 기준 예상 이익 = Σ 프로젝트(어미 + 귀속 하위 묶음) 이익 + 프로젝트 없는 매출 − 프로젝트 없는 일반경비 −
// 직원급여/상여/4대보험. 묶음 이익 = 묶음 매출(groupRevenue) − 매입(공급가) — 매입은 발주액과 상관없이 실제로 나간 돈이라
// 빠짐없이 뺀다. 프로젝트 없이 등록한 매출도 그 해 매출로 더함(예전엔 매입만 일반경비로 빠지고 매출은 빠져 이익이 적게 잡혔음).
// revenue = 그 매출 합계(대시보드 "예상 매출액"). projectTx = 이 프로젝트들에 붙은 거래 전부(기간 무관), yearTx = 그 해 거래 전부.
export function projectBasedProfit(
  projects: OutlookProject[],
  projectTx: OutlookTx[],
  yearTx: OutlookTx[],
  agencyByProject: Map<string, number>
) {
  const ids = new Set(projects.map((p) => p.id));
  const salesBy = new Map<string, number>();
  const purchaseBy = new Map<string, number>();
  for (const t of projectTx) {
    if (!t.project_id || !ids.has(t.project_id)) continue;
    salesBy.set(t.project_id, (salesBy.get(t.project_id) ?? 0) + salesSupplyOf(t));
    purchaseBy.set(t.project_id, (purchaseBy.get(t.project_id) ?? 0) + purchaseCostOf(t));
  }

  let projectProfit = 0;
  let projectRevenue = 0;
  let quoteTotal = 0;
  for (const { root, members } of projectGroups(projects)) {
    const quote = members.reduce((s, p) => s + countedQuote({ status: effectiveStatus(p, root), quote_amount: p.quote_amount }), 0);
    const revenue = groupRevenue(quote, sumByProject(members, agencyByProject), sumByProject(members, salesBy));
    projectRevenue += revenue;
    projectProfit += revenue - sumByProject(members, purchaseBy);
    quoteTotal += quote;
  }

  const generalSales = yearTx.filter((t) => t.type === "매출" && !t.project_id).reduce((s, t) => s + salesSupplyOf(t), 0);
  const nullProjectPurchases = yearTx.filter((t) => t.type === "매입" && !t.project_id);
  const payrollCost = nullProjectPurchases.filter(isPayroll).reduce((s, t) => s + purchaseCostOf(t), 0);
  const generalExpense = nullProjectPurchases.filter((t) => !isPayroll(t)).reduce((s, t) => s + purchaseCostOf(t), 0);
  return {
    projectProfit,
    generalSales,
    generalExpense,
    payrollCost,
    profit: projectProfit + generalSales - generalExpense - payrollCost,
    quoteTotal,
    revenue: projectRevenue + generalSales,
  };
}

// 연간 예상 이익(상반기 확정 + 하반기 예상)의 하반기 부분.
// - 하반기 매출−매입: 7~12월 거래(세금계산서 기준), 단 아래 "미발행" 묶음의 거래와 인건비 카테고리는 뺌.
// - 미발행 예상 이익: 진행중·공사 완료·완료 수금대기이고 발주액이 있는(0원·검토중 제외) 그 해 귀속 프로젝트 묶음(어미 + 귀속
//   하위)은 남은 발주액을 그 해 매출로 봄(unbilledH2Profit — 발주액 − 대행구매 − 하반기 전에 이미 끊은 매출, 하반기에 실제로 끊은
//   매출이 더 크면 그 금액, − 7~12월 매입). 다음 해에 계산서를 끊을 프로젝트는 사용자가 귀속 연도를 다음 해로 바꿈(사용자 운영
//   방식). 매출·매입은 그 해 12월 31일까지만 — 다음 해 것은 다음 해.
// - 하반기 인건비: 7~12월 직원급여/상여/4대보험 — 프로젝트를 지정한 것도 포함(미발행 묶음에 붙은 건 위에서 이미 뺌).
export function secondHalfOutlook(
  year: number,
  projects: OutlookProject[],
  projectTx: OutlookTx[],
  yearTx: OutlookTx[],
  agencyByProject: Map<string, number>
) {
  const yearStart = `${year}-01-01`;
  const h2Start = `${year}-07-01`;
  const yearEnd = `${year}-12-31`;
  const unbilled = unbilledGroups(projects);
  const groupIndex = new Map<string, number>();
  unbilled.forEach((g, i) => g.members.forEach((p) => groupIndex.set(p.id, i)));
  const inUnbilled = (t: OutlookTx) => Boolean(t.project_id && groupIndex.has(t.project_id));

  // 묶음마다 하반기 매입과 하반기 전에 이미 끊은 매출(기성금) — 올해 상반기분은 상반기 확정 이익(세무사 결산)에, 작년까지
  // 끊은 것은 그 해 이익에 들어가 있어 발주액에서 뺀다(예전엔 올해 상반기분만 빼서 작년 계산서가 올해 또 잡힐 수 있었음).
  const h2PurchaseBy = unbilled.map(() => 0);
  const h1BilledBy = unbilled.map(() => 0);
  const priorBilledBy = unbilled.map(() => 0);
  const h2BilledBy = unbilled.map(() => 0);
  for (const t of projectTx) {
    const i = t.project_id ? groupIndex.get(t.project_id) : undefined;
    if (i === undefined) continue;
    if (t.type === "매입" && t.trans_date >= h2Start && t.trans_date <= yearEnd) h2PurchaseBy[i] += purchaseCostOf(t);
    if (t.type === "매출" && t.trans_date < h2Start) {
      if (t.trans_date < yearStart) priorBilledBy[i] += salesSupplyOf(t);
      else h1BilledBy[i] += salesSupplyOf(t);
    }
    if (t.type === "매출" && t.trans_date >= h2Start && t.trans_date <= yearEnd) h2BilledBy[i] += salesSupplyOf(t);
  }
  const unbilledPendingProfit = unbilled.reduce(
    (s, g, i) =>
      s +
      unbilledH2Profit(
        g.quote,
        h1BilledBy[i] + priorBilledBy[i],
        h2PurchaseBy[i],
        sumByProject(g.members, agencyByProject),
        h2BilledBy[i]
      ),
    0
  );
  const total = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

  const h2Tx = yearTx.filter((t) => t.trans_date >= h2Start && t.trans_date <= yearEnd);
  const h2LedgerTx = h2Tx.filter((t) => !inUnbilled(t) && !isPayroll(t));
  const h2Sales = h2LedgerTx.reduce((s, t) => s + salesSupplyOf(t), 0);
  const h2Purchase = h2LedgerTx.reduce((s, t) => s + purchaseCostOf(t), 0);
  const h2PayrollCost = h2Tx.filter((t) => isPayroll(t) && !inUnbilled(t)).reduce((s, t) => s + purchaseCostOf(t), 0);
  const h2Profit = h2Sales - h2Purchase;
  return {
    h2Sales,
    h2Purchase,
    h2Profit,
    unbilledPendingProfit,
    h1BilledSales: total(h1BilledBy),
    priorBilledSales: total(priorBilledBy),
    unbilledProjectNames: unbilled.map((g) => g.label),
    h2PayrollCost,
    h2EstimatedProfit: h2Profit + unbilledPendingProfit - h2PayrollCost,
  };
}

// 미발행 묶음마다 남은 계산서 공급가액 = 발주액 − 대행구매액 − 이미 끊은 매출(날짜·외상 정산 무관, 0 아래로는 안 내려감 —
// 수금 예정액과 같은 기준). lastBilled = 마지막으로 끊은 매출 날짜. 1월 부가세 미발행 예상분과 프로젝트 목록 "연말 점검"이 같이 씀.
export function unbilledRemainingByGroup<P extends OutlookProject>(
  projects: P[],
  projectTx: OutlookTx[],
  agencyByProject: Map<string, number>
) {
  const billedBy = new Map<string, number>();
  const lastBilledBy = new Map<string, string>();
  for (const t of projectTx) {
    if (t.type !== "매출" || !t.project_id) continue;
    billedBy.set(t.project_id, (billedBy.get(t.project_id) ?? 0) + salesSupplyOf(t));
    if (t.trans_date > (lastBilledBy.get(t.project_id) ?? "")) lastBilledBy.set(t.project_id, t.trans_date);
  }
  return activeGroups(projects, UNBILLED_STATUSES)
    .filter((g) => g.quote > 0)
    .map((g) => {
      const agency = sumByProject(g.members, agencyByProject);
      const billed = sumByProject(g.members, billedBy);
      const lastBilled = g.members.map((p) => lastBilledBy.get(p.id) ?? "").sort().at(-1) || null;
      return { ...g, agency, billed, lastBilled, remaining: Math.max(0, g.quote - agency - billed) };
    });
}

// 1월 부가세(제2기 확정) 추정에 따로 더하는 "미발행 계산서 예상분"(사용자 결정). 미발행 묶음마다 남은 계산서 공급가액을
// 12월까지 끊는다고 보고 그 10%. 그 프로젝트에 앞으로 받을 매입 계산서의 부가세는 알 수 없어 빼지 않음(실제로는 그만큼 줄어듦).
export function unbilledInvoiceVat(
  projects: OutlookProject[],
  projectTx: OutlookTx[],
  agencyByProject: Map<string, number>
) {
  let count = 0;
  let supply = 0;
  let vat = 0;
  for (const g of unbilledRemainingByGroup(projects, projectTx, agencyByProject)) {
    if (g.remaining === 0) continue;
    count += 1;
    supply += g.remaining;
    vat += Math.round(g.remaining * 0.1);
  }
  return { count, supply, vat };
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
