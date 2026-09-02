"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";

export type UnassignedWorkLogRow = {
  id: string;
  date: string;
  siteName: string;
  title: string;
};

type SortKey = "date" | "siteName" | "title";

function sortValue(r: UnassignedWorkLogRow, key: SortKey): string {
  return r[key];
}

export function UnassignedWorkLogTable({
  rows,
  emptyMessage,
}: {
  rows: UnassignedWorkLogRow[];
  emptyMessage: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
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
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), "ko");
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
            <th className="pb-2 pr-4">{headerButton("date", "날짜")}</th>
            <th className="pb-2 pr-4">{headerButton("siteName", "현장")}</th>
            <th className="pb-2">{headerButton("title", "내용")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 text-slate-600">{formatDate(r.date)}</td>
              <td className="py-2 pr-4 text-slate-700">{r.siteName}</td>
              <td className="py-2 text-slate-700">{r.title || "(내용 없음)"}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
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
