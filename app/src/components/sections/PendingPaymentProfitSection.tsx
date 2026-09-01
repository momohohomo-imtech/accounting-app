import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";

function taxLine(taxBase: number) {
  const base = Math.max(taxBase, 0);
  const incomeTax = estimateIncomeTax(base);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(base)];
  return { totalTax, ratePct: Math.round(bracket.rate * 100) };
}

export async function PendingPaymentProfitSection() {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  const [{ data: pendingProjects }, { data: yearProjects }, { data: yearTx }] = await Promise.all([
    supabase.from("projects").select("id, contract_amount, quote_amount").eq("status", "done_awaiting_payment"),
    supabase.from("projects").select("id, quote_amount, status").eq("year", currentYear),
    supabase
      .from("transactions")
      .select("sales_amount, sales_vat, purchase_amount, purchase_vat")
      .gte("trans_date", `${currentYear}-01-01`)
      .lte("trans_date", `${currentYear}-12-31`),
  ]);

  const pendingRows = pendingProjects ?? [];
  const yearRows = yearProjects ?? [];
  if (pendingRows.length === 0 && yearRows.length === 0) return null;

  const yearProjectIds = yearRows.map((p) => p.id);
  const [{ data: purchaseTx }, { data: agencyTx }] = yearProjectIds.length
    ? await Promise.all([
        supabase.from("transactions").select("project_id, purchase_amount, purchase_vat").eq("type", "매입").in("project_id", yearProjectIds),
        supabase.from("project_agency_purchases").select("project_id, amount").in("project_id", yearProjectIds),
      ])
    : [{ data: [] as { project_id: string | null; purchase_amount: number; purchase_vat: number }[] }, { data: [] as { project_id: string; amount: number }[] }];

  // --- 미수금 포함 내역: 올해 전체 매출-매입(부가세 제외) + 완료 수금대기 프로젝트들의 미수 합계금 ---
  const yearSalesGross = (yearTx ?? []).reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
  const yearPurchase = (yearTx ?? []).reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
  const companyProfit = Math.round(yearSalesGross / 1.1) - yearPurchase;
  const pendingReceivable = pendingRows.reduce((s, p) => s + (p.contract_amount ?? p.quote_amount ?? 0), 0);
  const pendingTax = taxLine(companyProfit + pendingReceivable);

  // --- 전체 프로젝트 이익금 예상액 (프로젝트 목록·손익보고서와 동일한 방식: 발주액 - 매입합계 - 대행구매액, 발주액이 있는 프로젝트만) ---
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
  const yearProfits = yearProjectsWithProfit.map(
    (p) => p.quote_amount! - (purchaseByProject.get(p.id) ?? 0) - (agencyByProject.get(p.id) ?? 0)
  );
  const yearProfitSum = yearProfits.reduce((s, v) => s + v, 0);
  const yearTax = taxLine(yearProfitSum);
  const hasIncompleteProjects = yearProjectsWithProfit.some(
    (p) => p.status !== "done" && p.status !== "done_awaiting_payment"
  );

  return (
    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {pendingRows.length > 0 && (
        <p>
          <span className="font-semibold">완료 미수 합산</span>
          {" — "}
          이익 예상액{" "}
          <span className="font-mono font-semibold">{formatWon(companyProfit + pendingReceivable)}</span>
          {"(이익금 + 완료 수금대기) / "}
          {pendingRows.length}건 예상세액{" "}
          <span className="font-mono font-semibold">{formatWon(pendingTax.totalTax)}</span>
          {" (세율 "}
          <span className="font-mono font-semibold">{pendingTax.ratePct}%</span>
          {" 구간)"}
        </p>
      )}
      {yearProfits.length > 0 && (
        <p>
          <span className="font-semibold">전체 예상 합산</span>
          {" — "}
          이익 예상액{" "}
          <span className="font-mono font-semibold">{formatWon(yearProfitSum)}</span>
          {"(전체 프로젝트 이익금) / "}
          {yearProfits.length}건 예상세액{" "}
          <span className="font-mono font-semibold">{formatWon(yearTax.totalTax)}</span>
          {" (세율 "}
          <span className="font-mono font-semibold">{yearTax.ratePct}%</span>
          {" 구간)"}
          {hasIncompleteProjects && (
            <span className="font-semibold text-red-600"> ### 추가 매입/매출 있을 수 있음 ###</span>
          )}
        </p>
      )}
    </div>
  );
}
