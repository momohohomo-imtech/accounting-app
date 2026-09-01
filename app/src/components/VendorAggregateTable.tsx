"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";

type VendorAgg = { name: string; count: number; amount: number };
type SortKey = "name" | "count" | "amount";

export function VendorAggregateTable({
  rows,
  year,
  vendorAgency,
}: {
  rows: VendorAgg[];
  year: number;
  vendorAgency?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((v) => v.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="거래처 검색"
        className="mb-3 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none print:hidden"
      />
      <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("name", "거래처")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("count", "건수")}</th>
            <th className="pb-2 text-right">{headerButton("amount", vendorAgency ? "매입+대행구매 합계" : "매입 합계")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => (
            <tr key={v.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4">
                <Link
                  href={`/reports?year=${year}${vendorAgency ? "&vendorAgency=1" : ""}&vendor=${encodeURIComponent(v.name)}`}
                  className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline"
                >
                  {v.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right font-mono text-slate-700">{v.count}건</td>
              <td className="py-2 text-right font-mono text-slate-700">{formatWon(v.amount)}</td>
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
    </div>
  );
}
