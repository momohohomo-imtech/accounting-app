"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";

type CategoryAgg = { name: string; count: number; amount: number; color?: string };
type MergedRow = { name: string; count: number; amount: number; agencyCount: number; agencyAmount: number; color?: string };
type SortKey = "name" | "count" | "amount" | "agencyCount" | "agencyAmount";

function mergeRows(rows: CategoryAgg[], agencyRows: CategoryAgg[]): MergedRow[] {
  const map = new Map<string, MergedRow>();
  for (const r of rows) {
    map.set(r.name, { name: r.name, count: r.count, amount: r.amount, agencyCount: 0, agencyAmount: 0, color: r.color });
  }
  for (const a of agencyRows) {
    const existing = map.get(a.name);
    if (existing) {
      existing.agencyCount = a.count;
      existing.agencyAmount = a.amount;
      existing.color = existing.color ?? a.color;
    } else {
      map.set(a.name, { name: a.name, count: 0, amount: 0, agencyCount: a.count, agencyAmount: a.amount, color: a.color });
    }
  }
  return Array.from(map.values());
}

export function CategoryAggregateTable({
  rows,
  agencyRows = [],
  year,
}: {
  rows: CategoryAgg[];
  agencyRows?: CategoryAgg[];
  year: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const merged = useMemo(() => mergeRows(rows, agencyRows), [rows, agencyRows]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...merged];
    copy.sort((a, b) => {
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [merged, sortKey, sortDir]);

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
      <p className="mb-2 text-xs text-slate-400">
        대행구매액은 프로젝트 손익보고서에 참고용으로만 기록되는 금액으로, 매입장(매입 합계)과는 별개예요. 카테고리를
        클릭하면 상세 내역을 볼 수 있어요.
      </p>
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("name", "카테고리")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("count", "매입 건수")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("amount", "매입 합계")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("agencyCount", "대행구매 건수")}</th>
            <th className="pb-2 text-right">{headerButton("agencyAmount", "대행구매액 (프로젝트)")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <Link
                  href={`/reports?year=${year}&category=${encodeURIComponent(c.name)}`}
                  className={`underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline ${
                    c.name === "미분류" ? "font-medium text-red-600" : "text-slate-700"
                  }`}
                  style={c.name === "미분류" ? undefined : { color: c.color }}
                >
                  {c.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{c.count}건</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(c.amount)}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-500">{c.agencyCount}건</td>
              <td className="py-2 text-right font-mono text-slate-500">
                {c.agencyAmount > 0 ? formatWon(c.agencyAmount) : "-"}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-400">
                매입 거래가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
