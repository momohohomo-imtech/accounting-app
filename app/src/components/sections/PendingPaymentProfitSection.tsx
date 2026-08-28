import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";

export async function PendingPaymentProfitSection() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, contract_amount, quote_amount")
    .eq("status", "done_awaiting_payment");

  const projectRows = projects ?? [];
  if (projectRows.length === 0) return null;

  const ids = projectRows.map((p) => p.id);
  const { data: transactions } = await supabase
    .from("transactions")
    .select("project_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
    .in("project_id", ids);

  const byProject = new Map<string, { sales: number; purchase: number }>();
  for (const t of transactions ?? []) {
    if (!t.project_id) continue;
    const entry = byProject.get(t.project_id) ?? { sales: 0, purchase: 0 };
    entry.sales += t.sales_amount + t.sales_vat;
    entry.purchase += t.purchase_amount + t.purchase_vat;
    byProject.set(t.project_id, entry);
  }

  // 매출 손익 계산과 동일하게, 부가세 포함 매출 총액을 1.1로 나눠 부가세를 제외한다.
  let totalProfit = 0;
  let totalReceivable = 0;
  for (const p of projectRows) {
    const entry = byProject.get(p.id) ?? { sales: 0, purchase: 0 };
    totalProfit += Math.round(entry.sales / 1.1) - entry.purchase;
    totalReceivable += p.contract_amount ?? p.quote_amount ?? 0;
  }

  // 미수금까지 실현됐다고 가정했을 때의 예상 세금 (실제 이익금 + 미수 합계금 기준).
  const taxBase = Math.max(totalProfit + totalReceivable, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];

  return (
    <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      <span className="font-semibold">미수금 포함 내역</span>
      {" — "}실제 이익금 {projectRows.length}건 약{" "}
      <span className="font-mono font-semibold">{formatWon(totalProfit)}</span>
      {" + "}미수 합계금 약 <span className="font-mono font-semibold">{formatWon(totalReceivable)}</span>
      {" → "}예상세금 약 <span className="font-mono font-semibold">{formatWon(totalTax)}</span>
      {" (세율 "}
      <span className="font-mono font-semibold">{Math.round(bracket.rate * 100)}%</span>
      {" 구간)"}
    </p>
  );
}
