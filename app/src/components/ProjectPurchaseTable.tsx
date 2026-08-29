"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";

type PurchaseRow = {
  id: string;
  date: string;
  vendor: string;
  item: string;
  amount: number;
};

type SortKey = "date" | "vendor" | "item" | "amount";

function sortValue(r: PurchaseRow, key: SortKey): string | number {
  switch (key) {
    case "date":
      return r.date;
    case "vendor":
      return r.vendor;
    case "item":
      return r.item;
    case "amount":
      return r.amount;
  }
}

export function ProjectPurchaseTable({ rows }: { rows: PurchaseRow[] }) {
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
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("date", "날짜")}</th>
            <th className="pb-2 pr-4">{headerButton("vendor", "거래처")}</th>
            <th className="pb-2 pr-4">{headerButton("item", "품목")}</th>
            <th className="pb-2 text-right">{headerButton("amount", "금액")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 text-slate-600">{formatDate(r.date)}</td>
              <td className="py-2 pr-4 text-slate-700">{r.vendor}</td>
              <td className="py-2 pr-4 text-slate-700">{r.item}</td>
              <td className="py-2 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-slate-400">
                매입 내역이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
