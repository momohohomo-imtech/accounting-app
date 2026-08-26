"use client";

import { useMemo, useState } from "react";
import { deleteBankTransactionRecord } from "@/lib/actions/bank";
import { formatWon, formatDate } from "@/lib/format";

type BankTxRow = {
  id: string;
  trans_date: string;
  direction: string;
  description: string | null;
  amount: number;
  bank_accounts?: { nickname: string | null; bank_name: string } | null;
  clients?: { name: string } | null;
};

type SortKey = "trans_date" | "account" | "direction" | "description" | "client" | "amount";

function sortValue(t: BankTxRow, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return t.trans_date;
    case "account":
      return t.bank_accounts?.nickname ?? t.bank_accounts?.bank_name ?? "";
    case "direction":
      return t.direction;
    case "description":
      return t.description ?? "";
    case "client":
      return t.clients?.name ?? "";
    case "amount":
      return t.amount;
  }
}

export function BankTransactionTable({ transactions }: { transactions: BankTxRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
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
    if (!sortKey) return transactions;
    const copy = [...transactions];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  return (
    <table className="w-full min-w-[700px] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
          <th className="pb-2 pr-4">{headerButton("account", "계좌")}</th>
          <th className="pb-2 pr-4">{headerButton("direction", "구분")}</th>
          <th className="pb-2 pr-4">{headerButton("description", "적요")}</th>
          <th className="pb-2 pr-4">{headerButton("client", "매칭 거래처")}</th>
          <th className="pb-2 pr-4 text-right">{headerButton("amount", "금액")}</th>
          <th className="pb-2 text-right">관리</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.id} className="border-b border-slate-100 last:border-0">
            <td className="py-2 pr-4 text-slate-600">{formatDate(t.trans_date)}</td>
            <td className="py-2 pr-4 text-slate-700">{t.bank_accounts?.nickname ?? t.bank_accounts?.bank_name}</td>
            <td className="py-2 pr-4">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  t.direction === "입금" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                }`}
              >
                {t.direction}
              </span>
            </td>
            <td className="py-2 pr-4 text-slate-700">{t.description ?? "-"}</td>
            <td className="py-2 pr-4 text-slate-700">{t.clients?.name ?? "-"}</td>
            <td className="py-2 pr-4 text-right font-medium text-slate-900">{formatWon(t.amount)}</td>
            <td className="py-2 text-right">
              {confirmDeleteId === t.id ? (
                <form action={deleteBankTransactionRecord} className="flex items-center justify-end gap-1">
                  <input type="hidden" name="id" value={t.id} />
                  <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    취소
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(t.id)}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
            </td>
          </tr>
        ))}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={7} className="py-6 text-center text-slate-400">
              거래내역이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
