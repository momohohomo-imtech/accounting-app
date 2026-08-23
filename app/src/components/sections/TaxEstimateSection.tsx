import { createClient } from "@/lib/supabase/server";
import { formatWon } from "@/lib/format";
import { INCOME_TAX_BRACKETS, estimateIncomeTax, currentBracketIndex } from "@/lib/tax";

export async function TaxEstimateSection() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const elapsedMonths = now.getMonth() + 1;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("sales_amount, sales_vat, purchase_amount, purchase_vat")
    .gte("trans_date", `${year}-01-01`)
    .lte("trans_date", `${year}-12-31`);

  const rows = transactions ?? [];
  const salesYTD = rows.reduce((s, t) => s + t.sales_amount, 0);
  const purchaseYTD = rows.reduce((s, t) => s + t.purchase_amount, 0);
  const vatYTD = rows.reduce((s, t) => s + t.sales_vat - t.purchase_vat, 0);
  const profitYTD = salesYTD - purchaseYTD;

  const annualizedProfit = Math.round((profitYTD / elapsedMonths) * 12);
  const incomeTax = estimateIncomeTax(annualizedProfit);
  const localTax = Math.round(incomeTax * 0.1);
  const bracketIdx = currentBracketIndex(annualizedProfit);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{year}년 예상 세금 (개인사업자 종합소득세 기준)</h2>
        <p className="text-xs text-slate-400">1~{elapsedMonths}월 실적 기준 연환산 추정 · 참고용</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-500">연환산 예상 순이익</td>
              <td className="py-2 text-right font-mono font-medium text-slate-900">{formatWon(annualizedProfit)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-500">종합소득세 (추정)</td>
              <td className="py-2 text-right font-mono font-medium text-slate-900">{formatWon(incomeTax)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-500">지방소득세 (소득세의 10%)</td>
              <td className="py-2 text-right font-mono font-medium text-slate-900">{formatWon(localTax)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 text-slate-500">부가가치세 (연간 누적, 매출-매입 VAT)</td>
              <td className="py-2 text-right font-mono font-medium text-slate-900">{formatWon(Math.max(vatYTD, 0))}</td>
            </tr>
            <tr>
              <td className="py-2 font-semibold text-slate-900">예상 세금 합계</td>
              <td className="py-2 text-right font-mono text-lg font-bold text-red-600">
                {formatWon(incomeTax + localTax + Math.max(vatYTD, 0))}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-1.5">
          {INCOME_TAX_BRACKETS.map((b, i) => {
            const prevUpTo = i === 0 ? 0 : INCOME_TAX_BRACKETS[i - 1].upTo;
            const width = Math.min(
              100,
              Math.max(0, ((annualizedProfit - prevUpTo) / (b.upTo - prevUpTo)) * 100)
            );
            const filled = i < bracketIdx ? 100 : i === bracketIdx ? width : 0;
            return (
              <div key={b.rate} className="flex items-center gap-2 text-xs">
                <span className={`w-8 shrink-0 font-mono ${i === bracketIdx ? "font-bold text-slate-900" : "text-slate-400"}`}>
                  {Math.round(b.rate * 100)}%
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${i === bracketIdx ? "bg-amber-500" : "bg-slate-300"}`}
                    style={{ width: `${filled}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-slate-400">
                  ~{b.upTo === Infinity ? "∞" : formatWon(b.upTo)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        * 실제 실적을 단순 연환산한 추정치이며, 인적공제·기타 소득공제는 반영되지 않았습니다. 정확한 세액은 세무 신고 시
        세무사와 확인하세요.
      </p>
    </div>
  );
}
