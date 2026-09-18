"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";

export type PurchaseItemRow = {
  id: string;
  trans_date: string;
  clientName: string;
  projectName: string;
  categoryName: string;
  itemName: string;
  amount: number;
};

type SortKey = "trans_date" | "clientName" | "projectName" | "categoryName" | "itemName" | "amount";

function sortValue(r: PurchaseItemRow, key: SortKey): string | number {
  return key === "amount" ? r.amount : r[key];
}

export function PurchaseItemSearchTable({ rows }: { rows: PurchaseItemRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("trans_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" || key === "trans_date" ? "desc" : "asc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.itemName.toLowerCase().includes(q)) : [];
  }, [rows, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.reduce((s, r) => s + r.amount, 0);

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
        placeholder="품목명 검색"
        className="mb-3 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none print:hidden"
      />
      {query.trim() === "" ? (
        <p className="py-8 text-center text-sm text-slate-400 print:hidden">품목명을 입력하면 올해 매입 내역에서 검색합니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
                <th className="pb-2 pr-4">{headerButton("clientName", "거래처")}</th>
                <th className="pb-2 pr-4">{headerButton("projectName", "프로젝트")}</th>
                <th className="pb-2 pr-4">{headerButton("categoryName", "카테고리")}</th>
                <th className="pb-2 pr-4">{headerButton("itemName", "품목")}</th>
                <th className="pb-2 text-right">{headerButton("amount", "금액")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-600">{formatDate(r.trans_date)}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.clientName}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.projectName}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.categoryName}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.itemName}</td>
                  <td className="py-2 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={5} className="py-2 text-right font-semibold text-slate-900">
                    {sorted.length}건 합계
                  </td>
                  <td className="py-2 text-right font-mono font-bold text-slate-900">{formatWon(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
