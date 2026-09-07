"use client";

import { useMemo, useState } from "react";
import { formatWon } from "@/lib/format";
import { projectStatusLabel } from "@/lib/projectStatus";
import { cx } from "@/lib/cx";

export type RevenueVerificationRow = {
  id: string;
  name: string;
  siteName: string | null;
  status: string;
  quoteAmount: number;
  contractAmount: number;
  ledgerSales: number;
};

type SortKey = "name" | "siteName" | "quoteAmount" | "contractAmount" | "ledgerSales" | "diff";

function diffOf(r: RevenueVerificationRow) {
  return r.contractAmount - r.ledgerSales;
}

function sortValue(r: RevenueVerificationRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return r.name;
    case "siteName":
      return r.siteName ?? "";
    case "quoteAmount":
      return r.quoteAmount;
    case "contractAmount":
      return r.contractAmount;
    case "ledgerSales":
      return r.ledgerSales;
    case "diff":
      return diffOf(r);
  }
}

export function RevenueVerificationTable({ rows }: { rows: RevenueVerificationRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("diff");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const mismatchCount = rows.filter((r) => diffOf(r) !== 0).length;

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        수주액(실수령액으로 입력해둔 금액)과 실제 매출 원장(세금계산서 기준 매출, 부가세 제외) 합계를 대조합니다.
        {mismatchCount > 0 && <span className="ml-1 font-medium text-red-600">차이 있는 프로젝트 {mismatchCount}건</span>}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2 pr-4">{headerButton("name", "프로젝트명")}</th>
              <th className="pb-2 pr-4">{headerButton("siteName", "현장")}</th>
              <th className="pb-2 pr-4">상태</th>
              <th className="pb-2 pr-4 text-right">{headerButton("quoteAmount", "발주액")}</th>
              <th className="pb-2 pr-4 text-right">{headerButton("contractAmount", "수주액(실수령액)")}</th>
              <th className="pb-2 pr-4 text-right">{headerButton("ledgerSales", "실제 매출 원장")}</th>
              <th className="pb-2 text-right">{headerButton("diff", "차이")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const diff = diffOf(r);
              const mismatch = diff !== 0;
              return (
                <tr key={r.id} className={cx("border-b border-slate-100 last:border-0", mismatch && "bg-red-50")}>
                  <td className={cx("py-2 pr-4", mismatch ? "font-medium text-red-700" : "text-slate-700")}>{r.name}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.siteName ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-600">{projectStatusLabel(r.status)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(r.quoteAmount)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(r.contractAmount)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-700">{formatWon(r.ledgerSales)}</td>
                  <td className={cx("py-2 text-right font-mono font-semibold", mismatch ? "text-red-600" : "text-slate-400")}>
                    {formatWon(diff)}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
                  세금계산서를 끊은(수주액 또는 매출 원장이 있는) 프로젝트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
