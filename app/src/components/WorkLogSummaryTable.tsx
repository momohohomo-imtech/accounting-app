import type { WorkLogSummaryRow } from "@/lib/workLogSummary";
import { siteColorHex } from "@/lib/siteColor";

export function WorkLogSummaryTable({ rows, emptyMessage }: { rows: WorkLogSummaryRow[]; emptyMessage: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">현장</th>
            <th className="pb-2 pr-4">내용</th>
            <th className="pb-2 text-right">일수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.siteId}::${r.title}`} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: siteColorHex(r.siteId) }}
                  />
                  {r.siteName}
                </span>
              </td>
              <td className="py-2 pr-4 text-slate-700">{r.title}</td>
              <td className="py-2 text-right font-mono text-slate-900">{r.days}일</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
