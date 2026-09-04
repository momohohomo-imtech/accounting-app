import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";

export async function PendingPaymentProfitSection({ year }: { year: number }) {
  const supabase = await createClient();

  const [{ data: pendingProjects }, { data: yearProjects }, { data: generalTx }, { data: payrollRows }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, contract_amount, quote_amount")
        .eq("status", PROJECT_STATUS_AWAITING_PAYMENT),
      supabase.from("projects").select("id, quote_amount, status").eq("year", year),
      // "일반경비" = 프로젝트에 귀속되지 않은(project_id가 없는) 매입 거래 (앱 전반의 표시 관례와 동일)
      supabase
        .from("transactions")
        .select("purchase_amount, purchase_vat")
        .eq("type", "매입")
        .is("project_id", null)
        .gte("trans_date", `${year}-01-01`)
        .lte("trans_date", `${year}-12-31`),
      supabase
        .from("payroll")
        .select("amount, bonus, health_insurance, long_term_care_insurance, employment_insurance, national_pension")
        .gte("pay_month", `${year}-01-01`)
        .lte("pay_month", `${year}-12-31`),
    ]);

  const pendingRows = pendingProjects ?? [];
  const yearRows = yearProjects ?? [];
  if (pendingRows.length === 0 && yearRows.length === 0) return null;

  const yearProjectIds = yearRows.map((p) => p.id);
  const [{ data: purchaseTx }, { data: agencyTx }] = yearProjectIds.length
    ? await Promise.all([
        supabase
          .from("transactions")
          .select("project_id, purchase_amount, purchase_vat")
          .eq("type", "매입")
          .in("project_id", yearProjectIds),
        supabase.from("project_agency_purchases").select("project_id, amount").in("project_id", yearProjectIds),
      ])
    : [{ data: [] as { project_id: string | null; purchase_amount: number; purchase_vat: number }[] }, { data: [] as { project_id: string; amount: number }[] }];

  // --- 현재 공사 완료 수금 대기: 프로젝트 상태가 "완료 수금대기"인 건들의 수주액 합계 ---
  const pendingReceivable = pendingRows.reduce((s, p) => s + (p.contract_amount ?? p.quote_amount ?? 0), 0);

  // --- {year}년 이익 예상: 프로젝트 총이익금 - 카테고리 일반경비 - 직원급여/상여/4대보험 ---
  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseTx ?? []) {
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

  const generalExpense = (generalTx ?? []).reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const payrollCost = (payrollRows ?? []).reduce(
    (s, p) =>
      s + p.amount + p.bonus + p.health_insurance + p.long_term_care_insurance + p.employment_insurance + p.national_pension,
    0
  );
  const profitEstimate = yearProfitSum - generalExpense - payrollCost;

  return (
    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {pendingRows.length > 0 && (
        <p>
          <span className="font-semibold">현재 공사 완료 수금 대기</span>
          {" — "}
          <span className="font-mono font-semibold">{formatWon(pendingReceivable)}</span>
          {` (${pendingRows.length}건)`}
        </p>
      )}
      {yearProjectsWithProfit.length > 0 && (
        <p>
          <span className="font-semibold">{year}년 이익 예상</span>
          {" — "}
          <span className="font-mono font-semibold">{formatWon(profitEstimate)}</span>
          {" (프로젝트 총이익금 − 일반경비 − 직원급여/상여/4대보험)"}
          {hasIncompleteProjects && (
            <span className="font-semibold text-red-600"> ### 추가 매입/매출 있을 수 있음 ###</span>
          )}
        </p>
      )}
    </div>
  );
}
