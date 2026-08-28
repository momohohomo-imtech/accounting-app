"use client";

import { useState } from "react";
import type { SiteAggregateRow } from "@/lib/workLogSummary";
import { SiteAggregatePopup } from "@/components/SiteAggregatePopup";

export function SiteAggregateTable({
  rows,
  year,
  emptyMessage,
}: {
  rows: SiteAggregateRow[];
  year: number;
  emptyMessage: string;
}) {
  const [openSite, setOpenSite] = useState<SiteAggregateRow | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[400px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">현장</th>
            <th className="pb-2 pr-4 text-right">작업 종류 수</th>
            <th className="pb-2 text-right">일수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.siteId} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <button
                  type="button"
                  onClick={() => setOpenSite(r)}
                  className="inline-flex items-center gap-1.5 text-left text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.siteColor }} />
                  {r.siteName}
                </button>
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-900">{r.jobTypeCount}개</td>
              <td className="py-2 text-right font-mono text-slate-900">{r.dayCount}일</td>
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

      {openSite && (
        <SiteAggregatePopup
          siteId={openSite.siteId}
          siteName={openSite.siteName}
          siteColor={openSite.siteColor}
          initialYear={year}
          onClose={() => setOpenSite(null)}
        />
      )}
    </div>
  );
}
