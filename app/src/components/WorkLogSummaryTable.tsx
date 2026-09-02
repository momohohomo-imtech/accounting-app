"use client";

import { useMemo, useState } from "react";
import type { WorkLogSummaryRow } from "@/lib/workLogSummary";
import { WorkLogGroupDetailPopup } from "@/components/WorkLogGroupDetailPopup";

type SortKey = "siteName" | "title" | "days";

function sortValue(r: WorkLogSummaryRow, key: SortKey): string | number {
  switch (key) {
    case "siteName":
      return r.siteName;
    case "title":
      return r.title;
    case "days":
      return r.days;
  }
}

function formatMonthDay(dateKey: string) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function WorkLogSummaryTable({
  rows,
  emptyMessage,
  year,
}: {
  rows: WorkLogSummaryRow[];
  emptyMessage: string;
  year: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openGroup, setOpenGroup] = useState<WorkLogSummaryRow | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    // 휴무/사내/기타는 어떤 열로 정렬하든 항상 맨 아래 고정.
    const normal = rows.filter((r) => !r.isSpecial);
    const special = rows.filter((r) => r.isSpecial);
    if (sortKey) {
      normal.sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return [...normal, ...special];
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
      <table className="w-full min-w-[650px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("siteName", "현장")}</th>
            <th className="pb-2 pr-4">{headerButton("title", "내용")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("days", "일수")}</th>
            <th className="pb-2">날짜</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={`${r.siteId}::${r.title}`} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.siteColor }} />
                  {r.siteName}
                </span>
              </td>
              <td className="py-2 pr-4">
                <button
                  type="button"
                  onClick={() => setOpenGroup(r)}
                  className="text-left text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  {r.title}
                </button>
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-900">{r.days}일</td>
              <td className="py-2 text-xs text-slate-500">{r.dates.map(formatMonthDay).join(", ")}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {openGroup && (
        <WorkLogGroupDetailPopup
          year={year}
          siteId={openGroup.siteId}
          siteName={openGroup.siteName}
          siteColor={openGroup.siteColor}
          title={openGroup.title}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}
