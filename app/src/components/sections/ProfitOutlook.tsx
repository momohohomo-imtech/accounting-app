import { createClient } from "@/lib/supabase/server";
import { formatWon, moneyClass } from "@/lib/format";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";
import { taxEstimate } from "@/lib/tax";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, ExpenseCategory } from "@/lib/types";
import { one } from "@/lib/relations";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { PAYROLL_CATEGORY_NAME } from "@/lib/vatExempt";
import { purchaseCostOf, salesSupplyOf } from "@/lib/vatBasis";
import { totalProjectProfit, unbilledH2Profit } from "@/lib/projectProfit";

type YearTxRow = {
  id: string;
  type: string;
  payment_type: string;
  trans_date: string;
  project_id: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
  expense_categories: ExpenseCategory | null;
};
type YearProjectRow = { id: string; name: string; quote_amount: number | null; status: string | null };

// 대시보드의 이익·세금 추정치를 한 번에 계산 — 계산식은 기존 대시보드 박스와 동일하고,
// 화면 배치만 대시보드 쪽에서 나눠서 보여준다. 선택 연도의 거래·프로젝트·외상 정산 이력은
// 대시보드가 이미 받아온 것을 그대로 넘겨받아 같은 데이터를 다시 조회하지 않는다.
export async function loadProfitOutlook(
  year: number,
  {
    payments,
    yearProjects,
    yearTx,
  }: { payments: CreditPayment[]; yearProjects: YearProjectRow[]; yearTx: YearTxRow[] }
) {
  const supabase = await createClient();

  // 프로젝트에 귀속되지 않은(project_id가 없는) 매입 거래 전체(연간) — 카테고리별로
  // "일반경비"(직원급여 제외)와 "직원급여/상여/4대보험"(payroll 관리 화면이 아니라
  // 매입매출장의 이 카테고리 기준으로 집계, employees/payroll 입력 누락과 무관하게 실측)로 나눠 씀.
  const nullProjectTxRaw = yearTx.filter((t) => t.type === "매입" && !t.project_id);
  // 하반기 집계 이익금: 대시보드 "장부 기준 세금"과 같은 부가세 제외 매출-매입(원장 기준)으로 계산
  const h2TxRaw = yearTx.filter((t) => t.trans_date >= `${year}-07-01`);

  // 외상(미완납)은 대시보드의 다른 항목들과 동일하게 완납 전까지 장부에서 제외한다.
  const nullProjectTx = nullProjectTxRaw.filter((t) => isLedgerVisible(t, payments));
  const h2Tx = h2TxRaw.filter((t) => isLedgerVisible(t, payments));

  const payrollTx = nullProjectTx.filter((t) => one(t.expense_categories)?.name === PAYROLL_CATEGORY_NAME);
  const generalTx = nullProjectTx.filter((t) => one(t.expense_categories)?.name !== PAYROLL_CATEGORY_NAME);

  // 세금계산서 미발행 예상 이익금 대상: 완료 수금대기 + 공사 완료(둘 다 매출/세금계산서가
  // 아직 없는 경우가 많음 — 프로젝트 페이지의 hasIncompleteProjects 판단과 동일한 범위),
  // 마찬가지로 필터 연도로 한정.
  const unbilledRows = yearProjects.filter((p) => p.status === PROJECT_STATUS_AWAITING_PAYMENT || p.status === "done");
  const yearRows = yearProjects;

  // 완료 수금대기/공사 완료 프로젝트는 매입(원가)은 이미 원장에 찍혔지만 매출/세금계산서가
  // 아직 없는 경우가 많음 — 이 프로젝트들의 예상 이익도 같은 매입/대행구매 조회에 포함해서 구함.
  const yearProjectIds = yearRows.map((p) => p.id);
  const unbilledProjectIds = unbilledRows.map((p) => p.id);
  const allProjectIds = Array.from(new Set([...yearProjectIds, ...unbilledProjectIds]));
  type ProjectPurchaseTxRow = {
    id: string;
    type: string;
    payment_type: string;
    sales_amount: number;
    sales_vat: number;
    project_id: string | null;
    purchase_amount: number;
    purchase_vat: number;
    trans_date: string;
    expense_categories: { name: string } | { name: string }[] | null;
  };
  // 아래 프로젝트 매입 조회와 동시에 보내려고 먼저 시작(.then으로 바로 요청이 나가게).
  const halfYearPromise = supabase
    .from("half_year_settlements")
    .select("profit_amount")
    .eq("year", year)
    .eq("half", 1)
    .maybeSingle()
    .then((r) => r);
  const [purchaseTxRaw, { data: agencyTx }] = allProjectIds.length
    ? await Promise.all([
        fetchAllRows<ProjectPurchaseTxRow>((from, to) =>
          supabase
            .from("transactions")
            .select("id, type, payment_type, sales_amount, sales_vat, project_id, purchase_amount, purchase_vat, trans_date, expense_categories(*)")
            .eq("type", "매입")
            .in("project_id", allProjectIds)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        fetchAllRows<{ project_id: string; amount: number }>((from, to) =>
          supabase
            .from("project_agency_purchases")
            .select("project_id, amount")
            .in("project_id", allProjectIds)
            .order("id", { ascending: true })
            .range(from, to)
        ).then((data) => ({ data })),
      ])
    : [[] as ProjectPurchaseTxRow[], { data: [] as { project_id: string; amount: number }[] }];
  const { data: halfYearRow } = await halfYearPromise;
  // 외상(미완납)은 완납 전까지 장부에서 제외 — 다른 대시보드 항목들과 동일한 기준.
  const purchaseTx = purchaseTxRaw.filter((t) => isLedgerVisible(t, payments));


  // --- {year}년 이익 예상: 프로젝트 총이익금 - 카테고리 일반경비 - 직원급여/상여/4대보험 ---
  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseTx) {
    if (!t.project_id) continue;
    purchaseByProject.set(t.project_id, (purchaseByProject.get(t.project_id) ?? 0) + purchaseCostOf(t));
  }
  const agencyByProject = new Map<string, number>();
  for (const a of agencyTx ?? []) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + a.amount);
  }
  const yearProjectsWithProfit = yearRows.filter((p) => p.quote_amount != null);
  // 발주액이 없는 프로젝트(귀속 하위·미정리·검토중 등)에 들어간 매입도 실제 지출이라 같이 뺀다.
  const yearProfitSum = totalProjectProfit(yearRows, purchaseByProject, agencyByProject);
  // 추가 매입/매출이 더 생길 수 있는 건 아직 공사 중이거나 검토 중인 프로젝트뿐 — 수금 완료·귀속·기타는 제외.
  const hasIncompleteProjects = yearRows.some((p) => p.status === "ongoing" || p.status === "review");

  // 발주액·대행구매액이 부가세 제외라 매입·경비도 공급가(부가세 제외) 기준 — lib/vatBasis.ts.
  const generalExpense = generalTx.reduce((s, t) => s + purchaseCostOf(t), 0);
  const payrollCost = payrollTx.reduce((s, t) => s + purchaseCostOf(t), 0);
  const profitEstimate = yearProfitSum - generalExpense - payrollCost;
  const profitTax = taxEstimate(profitEstimate);

  // --- 하반기(7~12월) 집계 이익금 + 상반기 확정 이익금(세무사 결산) 합산 예상 세액 ---
  // 세금계산서 아직 안 끊은 이익금: 완료 수금대기·공사 완료 프로젝트는 매입은 원장에
  // 반영돼 있어도 매출이 아직 없어서 하반기 매출-매입만으로는 그 프로젝트의 예상 이익이
  // 누락됨 — 여기서 보충. 진행중 프로젝트도 발주액(이익금)이 잡혀 있는 건 같은 이유로 포함.
  // 상반기분 매입은 이미 상반기 확정 이익금(세무사 결산) 안에서 세무 처리가 끝났다고 보고,
  // 여기서는 하반기(7~12월)분 매입만 뺀다.
  const purchaseByProjectH2 = new Map<string, number>();
  for (const t of purchaseTx) {
    if (!t.project_id || t.trans_date < `${year}-07-01`) continue;
    purchaseByProjectH2.set(t.project_id, (purchaseByProjectH2.get(t.project_id) ?? 0) + purchaseCostOf(t));
  }
  const ongoingYearProjectsWithProfit = yearRows.filter((p) => p.status === "ongoing" && p.quote_amount != null);
  const unbilledProjectsWithProfit = [
    ...unbilledRows.filter((p) => p.quote_amount != null),
    ...ongoingYearProjectsWithProfit,
  ];
  const unbilledProjectIdSet = new Set(unbilledProjectsWithProfit.map((p) => p.id));
  // 상반기에 이미 끊은 기성금 — 세무사 결산은 계산서 기준이라 외상 미정산 건도 포함(장부 표시 여부와 무관).
  const h1BilledByProject = new Map<string, number>();
  for (const t of yearTx) {
    if (t.type !== "매출" || !t.project_id || !unbilledProjectIdSet.has(t.project_id)) continue;
    if (t.trans_date >= `${year}-07-01`) continue;
    h1BilledByProject.set(t.project_id, (h1BilledByProject.get(t.project_id) ?? 0) + salesSupplyOf(t));
  }
  const h1BilledSales = Array.from(h1BilledByProject.values()).reduce((s, v) => s + v, 0);
  const unbilledPendingProfit = unbilledProjectsWithProfit.reduce(
    (s, p) =>
      s +
      unbilledH2Profit(
        p.quote_amount!,
        h1BilledByProject.get(p.id) ?? 0,
        purchaseByProjectH2.get(p.id) ?? 0,
        agencyByProject.get(p.id) ?? 0
      ),
    0
  );
  // 미발행 예상 이익금에 이미 하반기 매입이 반영된 프로젝트들과, 직원급여 카테고리(아래
  // h2PayrollCost에서 따로 뺌)는 하반기 매출-매입 집계에서 빼서 이중으로 차감되지 않게 한다.
  const h2LedgerTx = h2Tx
    .filter((t) => !t.project_id || !unbilledProjectIdSet.has(t.project_id))
    .filter((t) => one(t.expense_categories)?.name !== PAYROLL_CATEGORY_NAME);
  const h2Sales = h2LedgerTx.reduce((s, t) => s + salesSupplyOf(t), 0);
  const h2Purchase = h2LedgerTx.reduce((s, t) => s + purchaseCostOf(t), 0);
  const h2Profit = h2Sales - h2Purchase;
  const h2PayrollCost = payrollTx
    .filter((t) => t.trans_date >= `${year}-07-01`)
    .reduce((s, t) => s + purchaseCostOf(t), 0);
  const half1Profit = halfYearRow?.profit_amount ?? null;
  const combinedProfit =
    half1Profit != null ? half1Profit + h2Profit + unbilledPendingProfit - h2PayrollCost : null;
  const combinedTax = combinedProfit != null ? taxEstimate(combinedProfit) : null;

  return {
    hasProjectsWithProfit: yearProjectsWithProfit.length > 0,
    profitEstimate,
    profitTax,
    hasIncompleteProjects,
    half1Profit,
    h2Sales,
    h2Purchase,
    h2Profit,
    unbilledPendingProfit,
    h1BilledSales,
    unbilledProjectNames: unbilledProjectsWithProfit.map((p) => p.name),
    h2PayrollCost,
    h2EstimatedProfit: h2Profit + unbilledPendingProfit - h2PayrollCost,
    combinedProfit,
    combinedTax,
  };
}

export type ProfitOutlook = Awaited<ReturnType<typeof loadProfitOutlook>>;

export function ProfitCalculationDetail({ year, o }: { year: number; o: ProfitOutlook }) {
  return (
    <div className="space-y-1 text-sm text-slate-700">
      <p>
        <span className="font-semibold">{year}년 하반기 매출-매입</span>
        {" — 매출 "}
        <span className="tabular-nums font-semibold">{formatWon(o.h2Sales)}</span>
        {" − 매입 "}
        <span className="tabular-nums font-semibold">{formatWon(o.h2Purchase)}</span>
        {" = "}
        <span className={`tabular-nums font-semibold ${moneyClass(o.h2Profit)}`}>{formatWon(o.h2Profit)}</span>
        {" (7~12월 원장 기준, 부가세 제외, 일반경비 포함)"}
      </p>
      <p>
        <span className="font-semibold">{year}년 세금계산서 미발행 예상 이익금</span>
        {" — "}
        <span className={`tabular-nums font-semibold ${moneyClass(o.unbilledPendingProfit)}`}>
          {formatWon(o.unbilledPendingProfit)}
        </span>
        {` (완료 수금대기·공사 완료·진행중 ${o.unbilledProjectNames.length}건)`}
        {o.h1BilledSales > 0 && (
          <span className="text-slate-500">
            {" — 상반기에 이미 끊은 기성금 "}
            <span className="tabular-nums">{formatWon(o.h1BilledSales)}</span>
            {"은 상반기 확정 이익금에 들어가 있어 뺐음"}
          </span>
        )}
      </p>
      {o.unbilledProjectNames.length > 0 && (
        <p className="pl-4 text-xs text-slate-500">{o.unbilledProjectNames.join(", ")}</p>
      )}
      <p>
        <span className="font-semibold">{year}년 하반기 직원급여/상여/4대보험</span>
        {" — "}
        <span className="tabular-nums font-semibold">{formatWon(o.h2PayrollCost)}</span>
      </p>
      <p className="text-slate-500">
        하반기 예상 이익금 = 하반기 매출-매입 + 세금계산서 미발행 예상 이익금 − 하반기 인건비
        <br />
        연간 합계 = 상반기 확정 + 하반기 예상 이익금
      </p>

      <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">왜 이렇게 나눠서 계산하나요?</p>
        <p>
          하반기(7~12월) 원장에는 두 종류의 프로젝트가 섞여 있습니다.
          <br />
          (가) 세금계산서를 다 발행하고 마감된 프로젝트 — 매출·매입이 둘 다 원장에 찍혀 있어 원장 합계만으로
          손익이 그대로 나옵니다.
          <br />
          (나) 완료수금대기·공사완료·진행중(발주액 있음) 프로젝트 — 자재비·인건비 등 매입은 이미
          원장에 찍혔지만, 세금계산서(매출)는 아직 발행 전이라 매출 쪽이 비어 있습니다.
        </p>
        <p>
          (나)를 원장 그대로 &quot;하반기 매출-매입&quot;에 합산하면 매입만 잡히고 매출은 안 잡힌 반쪽짜리
          숫자가 섞여 전체를 왜곡시킵니다. 그래서 (나)에 해당하는 거래는 &quot;하반기 매출-매입&quot;
          계산에서 제외하고, 대신 &quot;세금계산서 미발행 예상 이익금&quot;에서 &quot;발주액 − 하반기
          매입 − 대행구매액&quot;으로 따로 추정합니다. 이렇게 하면 (나) 프로젝트의 매입이 어느 한쪽에서
          정확히 한 번만 반영됩니다.
        </p>
        <p>
          (나) 프로젝트에 상반기(1~6월)에 이미 끊은 기성금이 있으면, 그 매출은 상반기 확정 이익금(세무사
          결산)에 들어가 있으므로 발주액에서 빼고 남은 금액만 하반기 몫으로 더합니다. 예: 발주액 5,000만원 중
          5월에 기성금 2,000만원을 끊었다면 하반기에는 3,000만원만 더합니다.
        </p>
        <p className="font-semibold text-slate-900">숫자 예시</p>
        <p>
          하반기 전체 매출 8,000만원, 전체 매입 1억 2,000만원(그중 (나) 프로젝트들의 매입이 5,000만원)이라고
          하면:
        </p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            하반기 매출-매입 = 8,000만원 − (1억 2,000만원 − 5,000만원) = 8,000만원 − 7,000만원 ={" "}
            <span className="font-semibold">1,000만원</span> ((나) 매입 5,000만원 제외)
          </li>
          <li>
            (나) 프로젝트들 발주액 합계 9,000만원, 하반기 매입 5,000만원(위에서 뺀 것과 동일), 대행구매
            500만원이라면 → 세금계산서 미발행 예상 이익금 = 9,000만원 − 5,000만원 − 500만원 ={" "}
            <span className="font-semibold">3,500만원</span>
          </li>
          <li>여기서 (나)의 매입 5,000만원은 위 두 줄 중 한쪽에서만 한 번 빠졌습니다.</li>
        </ul>
        <p>
          상반기 확정 3,000만원, 하반기 인건비 800만원까지 더하면:
          <br />
          연간 합계 = 3,000만원 + 1,000만원 + 3,500만원 − 800만원 ={" "}
          <span className="font-semibold">6,700만원</span>
        </p>
        <p className="text-slate-500">
          참고로 (나)를 제외하지 않고 &quot;하반기 매출-매입&quot;을 원장 그대로 다 더한 뒤 &quot;세금계산서
          미발행 예상 이익금&quot;을 그냥 더하면, (나) 프로젝트의 매입 5,000만원이 두 번(①하반기 매출-매입에서,
          ②미발행 예상 이익금 계산에서) 빠져서 실제보다 5,000만원만큼 적게(더 마이너스로) 나옵니다.
        </p>
      </div>
    </div>
  );
}
