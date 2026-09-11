"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";

type SiteRow = { name: string; sales: number; purchase: number; profit: number };
type SortKey = "name" | "sales" | "purchase" | "profit";

// 프로젝트에 안 묶인 거래("일반경비(현장 외)")는 현장이 아니라서 내역서 팝업으로 연결 안 함.
const NO_SITE_LABEL = "일반경비(현장 외)";

export function SiteProfitTable({ rows, year }: { rows: SiteRow[]; year: number }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
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
            <th className="pb-2 pr-4">{headerButton("name", "현장")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("sales", "매출")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("purchase", "매입")}</th>
            <th className="pb-2 text-right">{headerButton("profit", "손익")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                {s.name === NO_SITE_LABEL ? (
                  <span className="text-slate-700">{s.name}</span>
                ) : (
                  <Link
                    href={`/reports?year=${year}&siteReport=${encodeURIComponent(s.name)}`}
                    className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline"
                  >
                    {s.name}
                  </Link>
                )}
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(s.sales)}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(s.purchase)}</td>
              <td className="py-2 text-right font-mono font-medium text-slate-900">{formatWon(s.profit)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-slate-400">
                현장 데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
