"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";

type ProjectRow = {
  id: string;
  name: string;
  progress_pct: number | null;
  quoteAmount: number;
  sales: number;
  purchase: number;
  profit: number;
};

type SortKey = "name" | "progress_pct" | "quoteAmount" | "profitRate" | "sales" | "purchase";

function sortValue(p: ProjectRow & { profitRate: number }, key: SortKey): string | number {
  switch (key) {
    case "name":
      return p.name;
    case "progress_pct":
      return p.progress_pct ?? 0;
    case "quoteAmount":
      return p.quoteAmount;
    case "profitRate":
      return p.profitRate;
    case "sales":
      return p.sales;
    case "purchase":
      return p.purchase;
  }
}

export function ProjectProfitTable({
  rows,
  year,
  site,
}: {
  rows: ProjectRow[];
  year: number;
  site?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const withRate = useMemo(
    () => rows.map((p) => ({ ...p, profitRate: p.quoteAmount > 0 ? (p.profit / p.quoteAmount) * 100 : 0 })),
    [rows]
  );

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return withRate;
    const copy = [...withRate];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [withRate, sortKey, sortDir]);

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
      <table className="w-full min-w-[750px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("name", "프로젝트")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("progress_pct", "진행률")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("quoteAmount", "발주액")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("profitRate", "이익율")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("sales", "매출")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("purchase", "매입")}</th>
            <th className="pb-2 text-right">손익</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <Link
                  href={`/reports?year=${year}${site ? `&site=${site}` : ""}&project=${p.id}`}
                  className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline"
                >
                  {p.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{p.progress_pct ?? 0}%</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(p.quoteAmount)}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{p.profitRate.toFixed(1)}%</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(p.sales)}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(p.purchase)}</td>
              <td className="py-2 text-right font-mono text-slate-700">{formatWon(p.profit)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400">
                {year}년 프로젝트가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
