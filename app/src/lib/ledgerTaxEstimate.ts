import { createClient } from "@/lib/supabase/server";
import { estimateIncomeTax, currentBracketIndex, INCOME_TAX_BRACKETS } from "@/lib/tax";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { purchaseCostOf, salesSupplyOf } from "@/lib/vatBasis";

// 장부 매출−매입(부가세 제외 금액) 기준 연간 예상 종합소득세 — 대시보드 참고용.
export async function loadLedgerTaxEstimate(year: number) {
  const supabase = await createClient();

  const [transactions, creditPayments] = await Promise.all([
    fetchAllRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*, expense_categories(*)")
        .gte("trans_date", `${year}-01-01`)
        .lte("trans_date", `${year}-12-31`)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<CreditPayment>((from, to) =>
      supabase.from("credit_payments").select("*").order("id", { ascending: true }).range(from, to)
    ),
  ]);

  // 외상(미완납)은 다른 대시보드 항목과 동일하게 완납 전까지 장부에서 제외한다.
  const rows = transactions.filter((t) => isLedgerVisible(t, creditPayments));
  // 부가세 제외 기준(총액 ÷1.1, 비과세 카테고리는 총액 그대로) — lib/vatBasis.ts.
  const profitYTD = rows.reduce((s, t) => s + salesSupplyOf(t) - purchaseCostOf(t), 0);
  const taxBase = Math.max(profitYTD, 0);
  const incomeTax = estimateIncomeTax(taxBase);
  const localTax = Math.round(incomeTax * 0.1);
  const totalTax = incomeTax + localTax;
  const bracket = INCOME_TAX_BRACKETS[currentBracketIndex(taxBase)];
  return { taxBase, totalTax, ratePct: Math.round(bracket.rate * 100) };
}
