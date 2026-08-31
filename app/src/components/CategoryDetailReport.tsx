"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatWon, formatDate } from "@/lib/format";
import { CategoryReportActions } from "@/components/CategoryReportActions";
import { useEscapeKey } from "@/lib/useEscapeKey";

type DetailRow = {
  id: string;
  kind: "매입" | "대행구매";
  trans_date: string | null;
  client_name: string | null;
  project_name: string | null;
  item_name: string | null;
  amount: number;
};

type SortKey = "trans_date" | "client_name" | "project_name" | "item_name" | "amount";

function sortValue(r: DetailRow, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return r.trans_date ?? "";
    case "client_name":
      return r.client_name ?? "";
    case "project_name":
      return r.project_name ?? "";
    case "item_name":
      return r.item_name ?? "";
    case "amount":
      return r.amount;
  }
}

export function CategoryDetailReport({
  categoryName,
  year,
  purchaseRows,
  agencyRows,
  closeHref,
}: {
  categoryName: string;
  year: number;
  purchaseRows: DetailRow[];
  agencyRows: DetailRow[];
  closeHref: string;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  useEscapeKey(true, () => router.push(closeHref));

  const combined = useMemo(() => [...purchaseRows, ...agencyRows], [purchaseRows, agencyRows]);
  const purchaseTotal = purchaseRows.reduce((s, r) => s + r.amount, 0);
  const agencyTotal = agencyRows.reduce((s, r) => s + r.amount, 0);
  const exportRows = combined.map((r) => [
    r.kind,
    r.trans_date ? formatDate(r.trans_date) : "-",
    r.client_name ?? "-",
    r.project_name ?? "-",
    r.item_name ?? "-",
    r.amount,
  ]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return combined;
    const copy = [...combined];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [combined, sortKey, sortDir]);

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {categoryName} 총 매입내역 <span className="font-mono text-sm font-normal text-slate-400">{year}년</span>
        </h2>
        <div className="flex items-center gap-3 print:hidden">
          <CategoryReportActions
            categoryName={categoryName}
            year={year}
            rows={exportRows}
            purchaseTotal={purchaseTotal}
            agencyTotal={agencyTotal}
          />
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4">구분</th>
              <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
              <th className="pb-2 pr-4">{headerButton("client_name", "거래처")}</th>
              <th className="pb-2 pr-4">{headerButton("project_name", "프로젝트")}</th>
              <th className="pb-2 pr-4">{headerButton("item_name", "품목")}</th>
              <th className="pb-2 text-right">{headerButton("amount", "금액")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4">
                  <span className={r.kind === "대행구매" ? "text-slate-500" : "text-slate-700"}>{r.kind}</span>
                </td>
                <td className="py-2 pr-4 text-slate-600">{r.trans_date ? formatDate(r.trans_date) : "-"}</td>
                <td className="py-2 pr-4 text-slate-700">{r.client_name ?? "-"}</td>
                <td className="py-2 pr-4 text-slate-700">
                  {r.project_name ?? <span className="font-medium text-red-600">일반경비</span>}
                </td>
                <td className="py-2 pr-4 text-slate-700">{r.item_name ?? "-"}</td>
                <td className="py-2 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  매입 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-6 border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-600">
          매입 합계 <span className="ml-2 font-mono text-lg font-bold text-slate-900">{formatWon(purchaseTotal)}</span>
        </span>
        <span className="text-sm text-slate-600">
          대행구매액 합계 <span className="ml-2 font-mono text-lg font-bold text-slate-900">{formatWon(agencyTotal)}</span>
        </span>
      </div>
    </div>
  );
}
