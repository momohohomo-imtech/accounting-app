import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export async function PayslipView({ payrollId, closeHref }: { payrollId: string; closeHref: string }) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("payroll").select("*, employees(*)").eq("id", payrollId).single();
  if (!p) return null;

  const e = p.employees;
  const total = p.amount + p.bonus;
  const deductionTotal =
    p.health_insurance + p.long_term_care_insurance + p.employment_insurance + p.income_tax + p.local_income_tax + p.rural_tax;
  const net = total - deductionTotal + p.non_taxable_unreported;

  const deductionRows: [string, number][] = [
    ["건강보험", p.health_insurance],
    ["장기요양보험", p.long_term_care_insurance],
    ["고용보험", p.employment_insurance],
    ["소득세", p.income_tax],
    ["지방소득세", p.local_income_tax],
    ["농특세", p.rural_tax],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {e?.name} 급여명세서 <span className="font-mono text-sm font-normal text-slate-400">{formatDate(p.pay_month).slice(0, 7)}</span>
        </h2>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800 print:hidden">
            닫기
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-slate-100 pb-4 text-sm sm:grid-cols-3">
        <InfoField label="사원번호" value={e?.employee_no ?? "-"} />
        <InfoField label="성명" value={e?.name ?? "-"} />
        <InfoField label="직위" value={e?.role ?? "-"} />
        <InfoField label="부서" value={e?.department ?? "-"} />
        <InfoField label="입사일" value={formatDate(e?.hired_date)} />
        <InfoField label="퇴사일" value={e?.resigned_date ? formatDate(e.resigned_date) : "-"} />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">지급내역</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">기본급</td>
                <td className="py-1.5 text-right font-mono text-slate-900">{formatWon(p.amount)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-500">상여</td>
                <td className="py-1.5 text-right font-mono text-slate-900">{formatWon(p.bonus)}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-semibold text-slate-900">지급합계</td>
                <td className="py-1.5 text-right font-mono font-semibold text-slate-900">{formatWon(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">공제내역</h3>
          <table className="w-full text-sm">
            <tbody>
              {deductionRows.map(([label, value]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-500">{label}</td>
                  <td className="py-1.5 text-right font-mono text-slate-900">{formatWon(value)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5 font-semibold text-slate-900">공제합계</td>
                <td className="py-1.5 text-right font-mono font-semibold text-slate-900">{formatWon(deductionTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-500">
          미제출비과세 <span className="font-mono font-medium text-slate-700">{formatWon(p.non_taxable_unreported)}</span>
        </span>
        <span className="text-sm font-semibold text-slate-900">
          차인지급액(실지급액)
          <span className="ml-2 font-mono text-xl font-bold text-slate-900">{formatWon(net)}</span>
        </span>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-slate-700">{value}</p>
    </div>
  );
}
