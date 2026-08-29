"use client";

import { useMemo, useState } from "react";
import type { SiteAggregateRow } from "@/lib/workLogSummary";
import { SiteAggregatePopup } from "@/components/SiteAggregatePopup";

type SortKey = "siteName" | "jobTypeCount" | "dayCount";

function sortValue(r: SiteAggregateRow, key: SortKey): string | number {
  switch (key) {
    case "siteName":
      return r.siteName;
    case "jobTypeCount":
      return r.jobTypeCount;
    case "dayCount":
      return r.dayCount;
  }
}

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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[400px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("siteName", "현장")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("jobTypeCount", "작업 종류 수")}</th>
            <th className="pb-2 text-right">{headerButton("dayCount", "일수")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
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
