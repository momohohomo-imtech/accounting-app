"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon, formatDate } from "@/lib/format";

export type PurchaseItemRow = {
  id: string;
  trans_date: string;
  clientName: string;
  projectName: string;
  categoryName: string;
  itemName: string;
  amount: number;
  editHref: string;
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
    const raw = query.trim();
    if (!raw) return [];

    // "8월", "4월"처럼 "N월"이 포함되면 그 달로도 좁혀서 찾는다 — 나머지 글자는
    // 그대로 품목명 검색어로 씀(예: "판넬 8월" = 8월에 산 "판넬" 포함 품목).
    const monthMatch = raw.match(/(\d{1,2})\s*월/);
    let month: number | null = null;
    let textQuery = raw;
    if (monthMatch) {
      const m = Number(monthMatch[1]);
      if (m >= 1 && m <= 12) {
        month = m;
        textQuery = raw.slice(0, monthMatch.index) + raw.slice(monthMatch.index! + monthMatch[0].length);
        textQuery = textQuery.trim();
      }
    }
    const q = textQuery.toLowerCase();

    return rows.filter((r) => {
      if (month !== null && Number(r.trans_date.slice(5, 7)) !== month) return false;
      if (q && !r.itemName.toLowerCase().includes(q)) return false;
      return true;
    });
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
        placeholder="품목명 또는 'OO월' 검색"
        className="mb-3 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none print:hidden"
      />
      {query.trim() === "" ? (
        <p className="py-8 text-center text-sm text-slate-400 print:hidden">
          품목명을 입력하거나 &quot;8월&quot;처럼 입력하면 올해 매입 내역에서 검색합니다. 둘을 같이 쓰면(예: &quot;판넬
          8월&quot;) 그 달에 산 해당 품목만 찾습니다.
        </p>
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
                <th className="pb-2 pr-4 text-right">{headerButton("amount", "금액")}</th>
                <th className="pb-2 text-right print:hidden">관리</th>
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
                  <td className="py-2 pr-4 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
                  <td className="py-2 text-right print:hidden">
                    <Link
                      href={r.editHref}
                      className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                      수정
                    </Link>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
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
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
