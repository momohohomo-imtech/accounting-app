import Link from "next/link";
import { formatWon, formatDate } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type VendorRow = { id: string; trans_date: string; item_name: string | null; amount: number };

export function VendorDetailReport({
  vendorName,
  year,
  rows,
  closeHref,
}: {
  vendorName: string;
  year: number;
  rows: VendorRow[];
  closeHref: string;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {vendorName} 매입 내역 <span className="font-mono text-sm font-normal text-slate-400">{year}년</span>
        </h2>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800 print:hidden">
            닫기
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4">날짜</th>
              <th className="pb-2 pr-4">품목</th>
              <th className="pb-2 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4 text-slate-600">{formatDate(r.trans_date)}</td>
                <td className="py-2 pr-4 text-slate-700">{r.item_name ?? "-"}</td>
                <td className="py-2 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-400">
                  매입 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <span className="text-sm font-semibold text-slate-900">
          합계 <span className="ml-2 font-mono text-xl font-bold text-slate-900">{formatWon(total)}</span>
        </span>
      </div>
    </div>
  );
}
