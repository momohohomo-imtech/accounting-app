import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";

function sumProfit(projectIds: string[], transactions: { project_id: string | null; sales_amount: number; sales_vat: number; purchase_amount: number; purchase_vat: number }[]) {
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

export async function PendingPaymentProfitSection() {
  const supabase = await createClient();

  const [{ data: projects }, { data: allProjects }] = await Promise.all([
    supabase.from("projects").select("id, contract_amount, quote_amount").eq("status", "done_awaiting_payment"),
    supabase.from("projects").select("id"),
  ]);

  const projectRows = projects ?? [];
  const allProjectIds = (allProjects ?? []).map((p) => p.id);
  if (projectRows.length === 0 && allProjectIds.length === 0) return null;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("project_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
    .in("project_id", allProjectIds);

  const rows = transactions ?? [];
  const totalProfit = sumProfit(
    projectRows.map((p) => p.id),
    rows
  );
  const allProjectsProfit = sumProfit(allProjectIds, rows);
  const totalReceivable = projectRows.reduce((s, p) => s + (p.contract_amount ?? p.quote_amount ?? 0), 0);

  // 미수금까지 실현됐다고 가정했을 때의 예상 세금 (실제 이익금 + 미수 합계금 기준).
  const taxBase = Math.max(totalProfit + totalReceivable, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];

  return (
    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {projectRows.length > 0 && (
        <p>
          <span className="font-semibold">미수금 포함 내역</span>
          {" — "}실제 이익금 {projectRows.length}건 약{" "}
          <span className="font-mono font-semibold">{formatWon(totalProfit)}</span>
          {" + "}미수 합계금 약 <span className="font-mono font-semibold">{formatWon(totalReceivable)}</span>
          {" → "}예상세금 약 <span className="font-mono font-semibold">{formatWon(totalTax)}</span>
          {" (세율 "}
          <span className="font-mono font-semibold">{Math.round(bracket.rate * 100)}%</span>
          {" 구간)"}
        </p>
      )}
      {allProjectIds.length > 0 && (
        <p>
          <span className="font-semibold">전체 프로젝트 이익금 예상액</span>
          {" — "}등록된 프로젝트 {allProjectIds.length}건 전체 이익금 합계 약{" "}
          <span className="font-mono font-semibold">{formatWon(allProjectsProfit)}</span>
        </p>
      )}
    </div>
  );
}
