import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";

type TxRow = { project_id: string | null; sales_amount: number; sales_vat: number; purchase_amount: number; purchase_vat: number };

function sumProfit(projectIds: string[], transactions: TxRow[]) {
  const byProject = new Map<string, { sales: number; purchase: number }>();
  for (const t of transactions) {
    if (!t.project_id) continue;
    const entry = byProject.get(t.project_id) ?? { sales: 0, purchase: 0 };
    entry.sales += t.sales_amount + t.sales_vat;
    entry.purchase += t.purchase_amount + t.purchase_vat;
    byProject.set(t.project_id, entry);
  }
  // 매출 손익 계산과 동일하게, 부가세 포함 매출 총액을 1.1로 나눠 부가세를 제외한다.
  let total = 0;
  for (const id of projectIds) {
    const entry = byProject.get(id) ?? { sales: 0, purchase: 0 };
    total += Math.round(entry.sales / 1.1) - entry.purchase;
  }
  return total;
}

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

  const [{ data: pendingProjects }, { data: yearProjects }] = await Promise.all([
    supabase.from("projects").select("id, contract_amount, quote_amount").eq("status", "done_awaiting_payment"),
    supabase.from("projects").select("id, contract_amount").eq("year", currentYear),
  ]);

  const pendingRows = pendingProjects ?? [];
  const yearRows = yearProjects ?? [];
  if (pendingRows.length === 0 && yearRows.length === 0) return null;

  const allIds = Array.from(new Set([...pendingRows.map((p) => p.id), ...yearRows.map((p) => p.id)]));

  const [{ data: allTypeTx }, { data: purchaseTx }] = await Promise.all([
    supabase
      .from("transactions")
      .select("project_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
      .in("project_id", allIds),
    supabase
      .from("transactions")
      .select("project_id, purchase_amount, purchase_vat")
      .eq("type", "매입")
      .in(
        "project_id",
        yearRows.map((p) => p.id)
      ),
  ]);

  // --- 미수금 포함 내역 (완료 수금대기 프로젝트, 실제 거래 내역 기준) ---
  const rows = allTypeTx ?? [];
  const pendingProfit = sumProfit(
    pendingRows.map((p) => p.id),
    rows
  );
  const pendingReceivable = pendingRows.reduce((s, p) => s + (p.contract_amount ?? p.quote_amount ?? 0), 0);
  const pendingTax = taxLine(pendingProfit + pendingReceivable);

  // --- 전체 프로젝트 이익금 예상액 (프로젝트 목록·내역서와 동일한 방식: 수주액 - 매입 합계, 수주액이 있는 프로젝트만) ---
  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseTx ?? []) {
    if (!t.project_id) continue;
    purchaseByProject.set(t.project_id, (purchaseByProject.get(t.project_id) ?? 0) + t.purchase_amount + t.purchase_vat);
  }
  const yearProfits = yearRows
    .filter((p) => p.contract_amount != null)
    .map((p) => p.contract_amount! - (purchaseByProject.get(p.id) ?? 0));
  const yearProfitSum = yearProfits.reduce((s, v) => s + v, 0);
  const yearTax = taxLine(yearProfitSum);

  return (
    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {pendingRows.length > 0 && (
        <p>
          <span className="font-semibold">미수금 포함 내역</span>
          {" — "}실제 이익금 {pendingRows.length}건 약{" "}
          <span className="font-mono font-semibold">{formatWon(pendingProfit)}</span>
          {" + "}미수 합계금 약 <span className="font-mono font-semibold">{formatWon(pendingReceivable)}</span>
          {" → "}예상세금 약 <span className="font-mono font-semibold">{formatWon(pendingTax.totalTax)}</span>
          {" (세율 "}
          <span className="font-mono font-semibold">{pendingTax.ratePct}%</span>
          {" 구간)"}
        </p>
      )}
      {yearProfits.length > 0 && (
        <p>
          <span className="font-semibold">전체 프로젝트 이익금 예상액</span>
          {" — "}
          {currentYear}년 프로젝트 중 이익금 산정 가능한 {yearProfits.length}건 합계 약{" "}
          <span className="font-mono font-semibold">{formatWon(yearProfitSum)}</span>
          {" → "}예상세금 약 <span className="font-mono font-semibold">{formatWon(yearTax.totalTax)}</span>
          {" (세율 "}
          <span className="font-mono font-semibold">{yearTax.ratePct}%</span>
          {" 구간)"}
        </p>
      )}
    </div>
  );
}
