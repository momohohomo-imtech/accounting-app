"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";

type VendorAgg = { name: string; count: number; amount: number };
type MergedRow = { name: string; count: number; amount: number; agencyCount: number; agencyAmount: number };
type SortKey = "name" | "count" | "amount" | "agencyCount" | "agencyAmount";

// 매입(부가세 포함 총액)과 대행구매(부가세 제외 금액)는 기준이 달라서 더하지 않고 칸을 나눠 보여준다
// — CategoryAggregateTable과 같은 방식.
function mergeRows(rows: VendorAgg[], agencyRows: VendorAgg[]): MergedRow[] {
  const map = new Map<string, MergedRow>();
  for (const r of rows) map.set(r.name, { name: r.name, count: r.count, amount: r.amount, agencyCount: 0, agencyAmount: 0 });
  for (const a of agencyRows) {
    const existing = map.get(a.name);
    if (existing) {
      existing.agencyCount = a.count;
      existing.agencyAmount = a.amount;
    } else {
      map.set(a.name, { name: a.name, count: 0, amount: 0, agencyCount: a.count, agencyAmount: a.amount });
    }
  }
  return Array.from(map.values());
}

export function VendorAggregateTable({
  rows,
  agencyRows = [],
  year,
  vendorAgency,
}: {
  rows: VendorAgg[];
  agencyRows?: VendorAgg[];
  year: number;
  vendorAgency?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  const merged = useMemo(() => mergeRows(rows, vendorAgency ? agencyRows : []), [rows, agencyRows, vendorAgency]);

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
    return q ? merged.filter((v) => v.name.toLowerCase().includes(q)) : merged;
  }, [merged, query]);

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

  const colCount = vendorAgency ? 5 : 3;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="거래처 검색"
        className="mb-3 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none print:hidden"
      />
      {vendorAgency && (
        <p className="mb-2 text-xs text-slate-400">
          매입 합계는 부가세 포함 총액, 대행구매액은 부가세 제외 금액이라 서로 더하지 않고 따로 보여줘요.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${vendorAgency ? "min-w-[700px]" : "min-w-[600px]"}`}>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4">{headerButton("name", "거래처")}</th>
              <th className="pb-2 pr-4 text-right">{headerButton("count", vendorAgency ? "매입 건수" : "건수")}</th>
              <th className={`pb-2 text-right ${vendorAgency ? "pr-4" : ""}`}>{headerButton("amount", "매입 합계")}</th>
              {vendorAgency && (
                <>
                  <th className="pb-2 pr-4 text-right">{headerButton("agencyCount", "대행구매 건수")}</th>
                  <th className="pb-2 text-right">{headerButton("agencyAmount", "대행구매액 (부가세 제외)")}</th>
                </>
              )}
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
                <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{v.count}건</td>
                <td className={`py-2 text-right tabular-nums text-slate-700 ${vendorAgency ? "pr-4" : ""}`}>
                  {vendorAgency && v.amount === 0 ? "-" : formatWon(v.amount)}
                </td>
                {vendorAgency && (
                  <>
                    <td className="py-2 pr-4 text-right tabular-nums text-slate-500">{v.agencyCount}건</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {v.agencyAmount > 0 ? formatWon(v.agencyAmount) : "-"}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colCount} className="py-8 text-center text-slate-400">
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
