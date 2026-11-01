"use client";

import { useMemo, useState } from "react";
import { formatWon } from "@/lib/format";
import type { AgingItem } from "@/lib/receivableAging";

type SortKey = "client" | "trans_date" | "days" | "amount";

// 대시보드 "수금·지급 예정 상세"의 60일 넘은 외상매출금(lib/receivableAging.ts) — 헤더를 눌러 정렬.
export function ReceivableAgingTable({ items }: { items: AgingItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("days");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }
  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-1.5 pr-3">{headerButton("client", "거래처")}</th>
            <th className="pb-1.5 pr-3">{headerButton("trans_date", "계산서 일자")}</th>
            <th className="pb-1.5 pr-3 text-right">{headerButton("days", "경과일")}</th>
            <th className="pb-1.5 text-right">{headerButton("amount", "잔액")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="py-1.5 pr-3 text-slate-700 max-md:max-w-[10rem] max-md:truncate" title={it.item ? `${it.client} · ${it.item}` : it.client}>
                {it.client}
              </td>
              <td className="py-1.5 pr-3 tabular-nums text-slate-500">{it.trans_date}</td>
              <td className={`py-1.5 pr-3 text-right tabular-nums ${it.days > 90 ? "font-semibold text-red-600" : "text-slate-600"}`}>
                {it.days}일
              </td>
              <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-slate-800">{formatWon(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
