import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { estimateIncomeTax } from "@/lib/tax";

export async function TaxEstimateSection() {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("sales_amount, purchase_amount")
    .gte("trans_date", `${year}-01-01`)
    .lte("trans_date", `${year}-12-31`);

  const rows = transactions ?? [];
  const profitYTD = rows.reduce((s, t) => s + t.sales_amount - t.purchase_amount, 0);
  const incomeTax = estimateIncomeTax(profitYTD);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;

  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span className="font-semibold">{year}년 예상 세금 (개인사업자 종합소득세 기준)</span>
      {" — "}현재까지 매출이익{" "}
      <span className="font-mono font-semibold">{formatWon(Math.max(profitYTD, 0))}</span> 기준 예상 세액 약{" "}
      <span className="font-mono font-semibold">{formatWon(totalTax)}</span>
      <span className="ml-1 text-xs text-amber-700">(참고용, 공제 미반영)</span>
    </p>
  );
}
