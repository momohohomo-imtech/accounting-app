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

function buildLine(
  label: string,
  projectRows: { id: string; contract_amount: number | null; quote_amount: number | null }[],
  transactions: TxRow[]
) {
  const totalProfit = sumProfit(
    projectRows.map((p) => p.id),
    transactions
  );
  const totalReceivable = projectRows.reduce((s, p) => s + (p.contract_amount ?? p.quote_amount ?? 0), 0);

  // 미수금까지 실현됐다고 가정했을 때의 예상 세금 (실제 이익금 + 미수 합계금 기준).
  const taxBase = Math.max(totalProfit + totalReceivable, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];

  return (
    <p>
      <span className="font-semibold">{label}</span>
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

export async function PendingPaymentProfitSection() {
  const supabase = await createClient();

  const [{ data: pendingProjects }, { data: allProjects }] = await Promise.all([
    supabase.from("projects").select("id, contract_amount, quote_amount").eq("status", "done_awaiting_payment"),
    supabase.from("projects").select("id, contract_amount, quote_amount"),
  ]);

  const pendingRows = pendingProjects ?? [];
  const allRows = allProjects ?? [];
  if (pendingRows.length === 0 && allRows.length === 0) return null;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("project_id, sales_amount, sales_vat, purchase_amount, purchase_vat")
    .in(
      "project_id",
      allRows.map((p) => p.id)
    );

  const rows = transactions ?? [];

  return (
    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {pendingRows.length > 0 && buildLine("미수금 포함 내역", pendingRows, rows)}
      {allRows.length > 0 && buildLine("전체 프로젝트 이익금 예상액", allRows, rows)}
    </div>
  );
}
