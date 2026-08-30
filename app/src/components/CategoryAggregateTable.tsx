"use client";

import { useMemo, useState } from "react";
import { formatWon } from "@/lib/format";

type CategoryAgg = { name: string; count: number; amount: number; color?: string };
type SortKey = "name" | "count" | "amount";

export function CategoryAggregateTable({ rows }: { rows: CategoryAgg[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey];
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
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("name", "카테고리")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("count", "건수")}</th>
            <th className="pb-2 text-right">{headerButton("amount", "매입 합계")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <span className={c.name === "미분류" ? "font-medium text-red-600" : undefined} style={{ color: c.color }}>
                  {c.name}
                </span>
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{c.count}건</td>
              <td className="py-2 text-right font-mono text-slate-700">{formatWon(c.amount)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center text-slate-400">
                매입 거래가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
