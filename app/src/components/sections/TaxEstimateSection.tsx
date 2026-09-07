import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";

export async function TaxEstimateSection({ year }: { year: number }) {
  const supabase = await createClient();

  const [{ data: transactions }, { data: creditPayments }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("trans_date", `${year}-01-01`)
      .lte("trans_date", `${year}-12-31`),
    supabase.from("credit_payments").select("*"),
  ]);

  // 외상(미완납)은 다른 대시보드 항목과 동일하게 완납 전까지 장부에서 제외한다.
  const rows = ((transactions ?? []) as Transaction[]).filter((t) =>
    isLedgerVisible(t, (creditPayments ?? []) as CreditPayment[])
  );
  const profitYTD = rows.reduce((s, t) => s + t.sales_amount - t.purchase_amount, 0);
  const taxBase = Math.max(profitYTD, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];
  const isCurrentYear = year === new Date().getFullYear();

  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <span className="font-semibold">{year}년 예상 세금 (개인사업자 종합소득세 기준)</span>
      {isCurrentYear ? " — 현재까지 매출이익 " : " — 매출이익 "}
      <span className="font-mono font-semibold">{formatWon(taxBase)}</span> 기준, 적용 세율{" "}
      <span className="font-mono font-semibold">{Math.round(bracket.rate * 100)}%</span> 구간, 예상 세액 약{" "}
      <span className="font-mono font-semibold">{formatWon(totalTax)}</span>
      <span className="ml-1 text-xs text-amber-700">(지방소득세 10% 포함, 참고용·공제 미반영)</span>
    </p>
  );
}
