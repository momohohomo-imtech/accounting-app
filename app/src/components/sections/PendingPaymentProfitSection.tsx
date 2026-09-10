import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment } from "@/lib/types";
import { HalfYearSettlementInput } from "@/components/sections/HalfYearSettlementInput";
import { DetailToggle } from "@/components/DetailToggle";
import { one } from "@/lib/relations";

// 직원 급여/상여/4대보험 지출은 employees/payroll 관리 화면이 아니라 매입매출장에
// 이 카테고리로 찍힌 매입 기준으로 집계한다 (payroll 테이블은 입력이 다 안 돼 있어 누락됨).
const PAYROLL_CATEGORY_NAME = "직원급여/상여/4대보험";

function moneyClass(amount: number) {
  return amount < 0 ? "text-red-600" : "";
}

function taxEstimate(profit: number) {
  const taxBase = Math.max(profit, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];
  return { totalTax: incomeTax + localTax, ratePct: Math.round(bracket.rate * 100) };
}

export async function PendingPaymentProfitSection({ year }: { year: number }) {
  const supabase = await createClient();

  const [
    { data: pendingProjects },
    { data: unbilledProjects },
    { data: yearProjects },
    { data: nullProjectTxRaw },
    { data: halfYearRow },
    { data: h2TxRaw },
    { data: creditPayments },
  ] = await Promise.all([
    // 대시보드 필터 연도의 완료 수금대기 프로젝트만 (모든 항목을 필터 연도 기준으로 통일).
    supabase
      .from("projects")
      .select("id, contract_amount, quote_amount")
      .eq("status", PROJECT_STATUS_AWAITING_PAYMENT)
      .eq("year", year),
    // 세금계산서 미발행 예상 이익금 대상: 완료 수금대기 + 공사 완료(둘 다 매출/세금계산서가
    // 아직 없는 경우가 많음 — 프로젝트 페이지의 hasIncompleteProjects 판단과 동일한 범위),
    // 마찬가지로 필터 연도로 한정.
    supabase
      .from("projects")
      .select("id, name, quote_amount")
      .in("status", [PROJECT_STATUS_AWAITING_PAYMENT, "done"])
      .eq("year", year),
    supabase.from("projects").select("id, name, quote_amount, status").eq("year", year),
    // 프로젝트에 귀속되지 않은(project_id가 없는) 매입 거래 전체(연간) — 카테고리별로
    // "일반경비"(직원급여 제외)와 "직원급여/상여/4대보험"(payroll 관리 화면이 아니라
    // 매입매출장의 이 카테고리 기준으로 집계, employees/payroll 입력 누락과 무관하게 실측)로 나눠 씀.
    supabase
      .from("transactions")
      .select("id, type, payment_type, sales_amount, sales_vat, purchase_amount, purchase_vat, trans_date, expense_categories(name)")
      .eq("type", "매입")
      .is("project_id", null)
      .gte("trans_date", `${year}-01-01`)
      .lte("trans_date", `${year}-12-31`),
    supabase.from("half_year_settlements").select("profit_amount").eq("year", year).eq("half", 1).maybeSingle(),
    // 하반기 집계 이익금: TaxEstimateSection과 동일하게 부가세 제외한 매출-매입(원장 기준)으로 계산
    supabase
      .from("transactions")
      .select("id, type, payment_type, sales_amount, sales_vat, purchase_amount, purchase_vat, project_id, expense_categories(name)")
      .gte("trans_date", `${year}-07-01`)
      .lte("trans_date", `${year}-12-31`),
    supabase.from("credit_payments").select("*"),
  ]);

  // 외상(미완납)은 대시보드의 다른 항목들과 동일하게 완납 전까지 장부에서 제외한다.
  const payments = (creditPayments ?? []) as CreditPayment[];
  const nullProjectTx = (nullProjectTxRaw ?? []).filter((t) => isLedgerVisible(t, payments));
  const h2Tx = (h2TxRaw ?? []).filter((t) => isLedgerVisible(t, payments));

  const payrollTx = nullProjectTx.filter((t) => one(t.expense_categories)?.name === PAYROLL_CATEGORY_NAME);
  const generalTx = nullProjectTx.filter((t) => one(t.expense_categories)?.name !== PAYROLL_CATEGORY_NAME);

  const pendingRows = pendingProjects ?? [];
  const unbilledRows = unbilledProjects ?? [];
  const yearRows = yearProjects ?? [];
  if (pendingRows.length === 0 && yearRows.length === 0) return null;

  // 완료 수금대기/공사 완료 프로젝트는 매입(원가)은 이미 원장에 찍혔지만 매출/세금계산서가
  // 아직 없는 경우가 많음 — 이 프로젝트들의 예상 이익도 같은 매입/대행구매 조회에 포함해서 구함.
  const yearProjectIds = yearRows.map((p) => p.id);
  const unbilledProjectIds = unbilledRows.map((p) => p.id);
  const allProjectIds = Array.from(new Set([...yearProjectIds, ...unbilledProjectIds]));
  const [{ data: purchaseTxRaw }, { data: agencyTx }] = allProjectIds.length
    ? await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, payment_type, sales_amount, sales_vat, project_id, purchase_amount, purchase_vat, trans_date")
          .eq("type", "매입")
          .in("project_id", allProjectIds),
        supabase.from("project_agency_purchases").select("project_id, amount").in("project_id", allProjectIds),
      ])
    : [
        {
          data: [] as {
            id: string;
            type: string;
            payment_type: string;
            sales_amount: number;
            sales_vat: number;
            project_id: string | null;
            purchase_amount: number;
            purchase_vat: number;
            trans_date: string;
          }[],
        },
        { data: [] as { project_id: string; amount: number }[] },
      ];
  // 외상(미완납)은 완납 전까지 장부에서 제외 — 다른 대시보드 항목들과 동일한 기준.
  const purchaseTx = (purchaseTxRaw ?? []).filter((t) => isLedgerVisible(t, payments));

  // --- {year}년 공사 완료 수금 대기: 필터 연도의 프로젝트 상태가 "완료 수금대기"인 건들의 수주액 합계 ---
  const pendingReceivable = pendingRows.reduce((s, p) => s + (p.contract_amount ?? p.quote_amount ?? 0), 0);

  // --- {year}년 이익 예상: 프로젝트 총이익금 - 카테고리 일반경비 - 직원급여/상여/4대보험 ---
  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseTx) {
    if (!t.project_id) continue;
    purchaseByProject.set(t.project_id, (purchaseByProject.get(t.project_id) ?? 0) + t.purchase_amount + t.purchase_vat);
  }
  const agencyByProject = new Map<string, number>();
  for (const a of agencyTx ?? []) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + a.amount);
  }
  const yearProjectsWithProfit = yearRows.filter((p) => p.quote_amount != null);
  const yearProfitSum = yearProjectsWithProfit.reduce(
    (s, p) => s + p.quote_amount! - (purchaseByProject.get(p.id) ?? 0) - (agencyByProject.get(p.id) ?? 0),
    0
  );
  const hasIncompleteProjects = yearProjectsWithProfit.some(
    (p) => p.status !== "done" && p.status !== PROJECT_STATUS_AWAITING_PAYMENT
  );

  const generalExpense = generalTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const payrollCost = payrollTx.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
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
    purchaseByProjectH2.set(t.project_id, (purchaseByProjectH2.get(t.project_id) ?? 0) + t.purchase_amount + t.purchase_vat);
  }
  const ongoingYearProjectsWithProfit = yearRows.filter((p) => p.status === "ongoing" && p.quote_amount != null);
  const unbilledProjectsWithProfit = [
    ...unbilledRows.filter((p) => p.quote_amount != null),
    ...ongoingYearProjectsWithProfit,
  ];
  const unbilledPendingProfit = unbilledProjectsWithProfit.reduce(
    (s, p) => s + p.quote_amount! - (purchaseByProjectH2.get(p.id) ?? 0) - (agencyByProject.get(p.id) ?? 0),
    0
  );
  // 미발행 예상 이익금에 이미 하반기 매입이 반영된 프로젝트들과, 직원급여 카테고리(아래
  // h2PayrollCost에서 따로 뺌)는 하반기 매출-매입 집계에서 빼서 이중으로 차감되지 않게 한다.
  const unbilledProjectIdSet = new Set(unbilledProjectsWithProfit.map((p) => p.id));
  const h2LedgerTx = h2Tx
    .filter((t) => !t.project_id || !unbilledProjectIdSet.has(t.project_id))
    .filter((t) => one(t.expense_categories)?.name !== PAYROLL_CATEGORY_NAME);
  const h2Sales = h2LedgerTx.reduce((s, t) => s + t.sales_amount, 0);
  const h2Purchase = h2LedgerTx.reduce((s, t) => s + t.purchase_amount, 0);
  const h2Profit = h2Sales - h2Purchase;
  const h2PayrollCost = payrollTx
    .filter((t) => t.trans_date >= `${year}-07-01`)
    .reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const half1Profit = halfYearRow?.profit_amount ?? null;
  const combinedProfit =
    half1Profit != null ? half1Profit + h2Profit + unbilledPendingProfit - h2PayrollCost : null;
  const combinedTax = combinedProfit != null ? taxEstimate(combinedProfit) : null;

  return (
    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {pendingRows.length > 0 && (
        <p>
          <span className="font-semibold">{year}년 공사 완료 수금 대기</span>
          {" — "}
          <span className="font-mono font-semibold">{formatWon(pendingReceivable)}</span>
          {` (${pendingRows.length}건)`}
        </p>
      )}
      {yearProjectsWithProfit.length > 0 && (
        <p>
          <span className="font-semibold">{year}년 이익 예상</span>
          {" — "}
          <span className={`font-mono font-semibold ${moneyClass(profitEstimate)}`}>{formatWon(profitEstimate)}</span>
          {" (프로젝트 총이익금 − 일반경비 − 직원급여/상여/4대보험) / "}
          개인사업자 세율구간{" "}
          <span className="font-mono font-semibold">{profitTax.ratePct}%</span>
          {", 예상 세액 약 "}
          <span className="font-mono font-semibold">{formatWon(profitTax.totalTax)}</span>
          {hasIncompleteProjects && (
            <span className="font-semibold text-red-600"> ### 추가 매입/매출 있을 수 있음 ###</span>
          )}
        </p>
      )}

      <div className="mt-1 space-y-1 border-t border-blue-200 pt-2">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{year}년 상반기 확정 이익금 (세무사 결산)</span>
          {half1Profit != null ? (
            <span className="font-mono font-semibold">{formatWon(half1Profit)}</span>
          ) : (
            <span className="text-blue-700">미입력</span>
          )}
          <HalfYearSettlementInput year={year} initialAmount={half1Profit} />
        </p>
        {half1Profit != null && combinedProfit != null && combinedTax != null && (
          <>
            <p>
              <span className="font-semibold">{year}년 연간 합계 예상 이익금</span>
              {" — "}
              <span className={`font-mono font-semibold ${moneyClass(combinedProfit)}`}>{formatWon(combinedProfit)}</span>
              {" / 예상 세액 약 "}
              <span className="font-mono font-semibold">{formatWon(combinedTax.totalTax)}</span>
              {" (세율 "}
              <span className="font-mono font-semibold">{combinedTax.ratePct}%</span>
              {" 구간)"}
            </p>
            <DetailToggle label="계산 과정 보기">
              <p>
                <span className="font-semibold">{year}년 하반기 매출-매입</span>
                {" — 매출 "}
                <span className="font-mono font-semibold">{formatWon(h2Sales)}</span>
                {" − 매입 "}
                <span className="font-mono font-semibold">{formatWon(h2Purchase)}</span>
                {" = "}
                <span className={`font-mono font-semibold ${moneyClass(h2Profit)}`}>{formatWon(h2Profit)}</span>
                {" (7~12월 원장 기준, 부가세 제외, 일반경비 포함)"}
              </p>
              <p>
                <span className="font-semibold">{year}년 세금계산서 미발행 예상 이익금</span>
                {" — "}
                <span className={`font-mono font-semibold ${moneyClass(unbilledPendingProfit)}`}>
                  {formatWon(unbilledPendingProfit)}
                </span>
                {` (완료 수금대기·공사 완료·진행중 ${unbilledProjectsWithProfit.length}건)`}
              </p>
              <p>
                <span className="font-semibold">{year}년 하반기 직원급여/상여/4대보험</span>
                {" — "}
                <span className="font-mono font-semibold">{formatWon(h2PayrollCost)}</span>
              </p>
              <p className="text-blue-700">
                연간 합계 = 상반기 확정 + 하반기 매출-매입 + 세금계산서 미발행 예상 이익금 − 하반기 인건비
              </p>

              <div className="mt-2 space-y-2 rounded-lg bg-white/70 p-3 text-xs leading-relaxed text-slate-700">
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
            </DetailToggle>
            {unbilledProjectsWithProfit.length > 0 && (
              <p className="pl-4 text-xs text-blue-700">
                {unbilledProjectsWithProfit.map((p) => p.name).join(", ")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
