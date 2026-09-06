"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatWon } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";

export type ClassificationPendingRow = {
  id: string;
  date: string;
  type: string;
  clientName: string;
  itemName: string;
  amount: number;
  editHref: string;
};

type SortKey = "date" | "type" | "clientName" | "itemName" | "amount";

export function ClassificationPendingTable({ rows }: { rows: ClassificationPendingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ko");
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
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("date", "날짜")}</th>
            <th className="pb-2 pr-4">{headerButton("type", "구분")}</th>
            <th className="pb-2 pr-4">{headerButton("clientName", "거래처")}</th>
            <th className="pb-2 pr-4">{headerButton("itemName", "품목")}</th>
            <th className="pb-2 text-right">{headerButton("amount", "금액")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="py-2 pr-4 text-slate-600">
                <Link href={r.editHref} className="block">
                  {formatDate(r.date)}
                </Link>
              </td>
              <td className="py-2 pr-4">
                <Link href={r.editHref} className="block">
                  <Badge variant={r.type === "매출" ? "blue" : "orange"}>{r.type}</Badge>
                </Link>
              </td>
              <td className="py-2 pr-4 text-slate-700">
                <Link href={r.editHref} className="block">
                  {r.clientName}
                </Link>
              </td>
              <td className="py-2 pr-4 text-slate-700">
                <Link href={r.editHref} className="block">
                  {r.itemName}
                </Link>
              </td>
              <td className="py-2 text-right font-mono text-slate-700">
                <Link href={r.editHref} className="block">
                  {formatWon(r.amount)}
                </Link>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-slate-400">
                분류 대기 중인 거래가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
