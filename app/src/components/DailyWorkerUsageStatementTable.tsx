"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";

type StatementRow = {
  id: string;
  trans_date: string;
  client_name: string;
  project_name: string;
  item_name: string;
  note: string;
  amount: number;
};

type SortKey = "trans_date" | "client_name" | "project_name" | "item_name" | "amount";

function sortValue(r: StatementRow, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return r.trans_date;
    case "client_name":
      return r.client_name;
    case "project_name":
      return r.project_name;
    case "item_name":
      return r.item_name;
    case "amount":
      return r.amount;
  }
}

export function DailyWorkerUsageStatementTable({ rows }: { rows: StatementRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("trans_date");
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
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  function headerButton(key: SortKey, label: string) {
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center justify-center gap-1 hover:text-slate-800"
      >
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-300 text-slate-500">
          <th className="py-1.5 pr-2 text-center">번호</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("trans_date", "날짜")}</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("client_name", "인력사무소")}</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("project_name", "현장")}</th>
          <th className="py-1.5 pr-2 text-center">{headerButton("item_name", "품목")}</th>
          <th className="py-1.5 pr-2 text-center">비고</th>
          <th className="py-1.5 text-center">{headerButton("amount", "금액")}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.id} className="border-b border-slate-200 text-slate-700">
            <td className="py-1.5 pr-2 text-center">{i + 1}</td>
            <td className="py-1.5 pr-2 text-center">{formatDate(r.trans_date)}</td>
            <td className="py-1.5 pr-2 text-center">{r.client_name}</td>
            <td className="py-1.5 pr-2 text-center">{r.project_name || "-"}</td>
            <td className="py-1.5 pr-2 text-center">{r.item_name || "-"}</td>
            <td className="py-1.5 pr-2 text-center">{r.note || "-"}</td>
            <td className="py-1.5 text-right font-medium text-slate-900">{formatWon(r.amount)}</td>
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={7} className="py-6 text-center text-slate-400">
              해당 월의 사용내역이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
      {sorted.length > 0 && (
        <tfoot>
          <tr className="border-t-2 border-slate-900 font-semibold text-slate-900">
            <td colSpan={6} className="py-2 pr-2 text-center">
              합계 ({sorted.length}건)
            </td>
            <td className="py-2 text-right">{formatWon(total)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
