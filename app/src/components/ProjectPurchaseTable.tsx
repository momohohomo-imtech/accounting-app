"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { ReportBulkEditBar } from "@/components/ReportBulkEditBar";
import { useRowSelection } from "@/lib/useRowSelection";

type PurchaseRow = {
  id: string;
  date: string;
  vendor: string;
  item: string;
  category: string;
  categoryColor?: string;
  amount: number;
  // 외상(미완납) 건 — 정산 전까지 매입 합계·이익금 계산에서는 빠지지만 목록에는 참고용으로 표시.
  unsettled?: boolean;
  // 여러 프로젝트를 합친 보고서(통합 보고서)에서 어느 프로젝트 매입인지 — showProject일 때만 칸이 보임.
  project?: string;
};

type SortKey = "date" | "project" | "vendor" | "item" | "category" | "amount";

function sortValue(r: PurchaseRow, key: SortKey): string | number {
  switch (key) {
    case "date":
      return r.date;
    case "project":
      return r.project ?? "";
    case "vendor":
      return r.vendor;
    case "item":
      return r.item;
    case "category":
      return r.category;
    case "amount":
      return r.amount;
  }
}

// canEdit(관리자·직원): 매입을 체크해서 프로젝트·거래처·카테고리·결제방식·품목을 한 번에(11/11, ReportBulkEditBar) — 체크칸과
// 일괄 변경 칸은 인쇄·엑셀에 안 나옴.
export function ProjectPurchaseTable({
  rows,
  showProject = false,
  canEdit = false,
}: {
  rows: PurchaseRow[];
  showProject?: boolean;
  canEdit?: boolean;
}) {
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

  const selection = useRowSelection(useMemo(() => sorted.map((r) => r.id), [sorted]));

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
      {canEdit && selection.chosen.length > 0 && (
        <ReportBulkEditBar selectedIds={selection.chosen} onDone={selection.clear} onClear={selection.clear} />
      )}
      <div className="overflow-x-auto">
        {/* 휴대폰에서는 거래처·카테고리 칸을 넓혀 덜 잘리게(표 전체를 옆으로 넘김), 인쇄는 원래 폭 그대로 */}
        <table
          className={`sticky-col-table w-full table-fixed text-sm print:text-[10px] ${
            showProject ? "min-w-[760px] max-md:min-w-[840px] print:min-w-0" : "min-w-[600px] max-md:min-w-[680px] print:min-w-[600px]"
          }`}
        >
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {canEdit && (
                <th className="w-8 pb-2 pr-2 print:hidden">
                  <input
                    type="checkbox"
                    aria-label="매입 전체 선택"
                    checked={selection.allOn}
                    onChange={selection.toggleAll}
                    className="h-4 w-4 accent-slate-900"
                  />
                </th>
              )}
              <th className="w-[88px] pb-2 pr-4 print:pb-1">{headerButton("date", "날짜")}</th>
              {showProject && <th className="w-[160px] pb-2 pr-4 print:w-[130px] print:pb-1">{headerButton("project", "프로젝트")}</th>}
              <th className="sticky-col w-[100px] pb-2 pr-4 max-md:w-[140px] print:w-[100px] print:pb-1">{headerButton("vendor", "거래처")}</th>
              <th className="pb-2 pr-4 print:pb-1">{headerButton("item", "품목")}</th>
              <th className="w-[90px] pb-2 pr-4 max-md:w-[120px] print:w-[90px] print:pb-1">{headerButton("category", "카테고리")}</th>
              <th className="w-[110px] pb-2 text-right print:pb-1">{headerButton("amount", "금액")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-slate-100 last:border-0 ${
                  selection.selected.has(r.id) ? "bg-brand-soft" : r.unsettled ? "bg-amber-50/60" : ""
                }`}
              >
                {canEdit && (
                  <td className="py-2 pr-2 print:hidden">
                    <input
                      type="checkbox"
                      aria-label={`${r.vendor} ${r.item} 선택`}
                      checked={selection.selected.has(r.id)}
                      onChange={() => selection.toggle(r.id)}
                      className="h-4 w-4 accent-slate-900"
                    />
                  </td>
                )}
                <td className="py-2 pr-4 text-slate-600 print:py-0.5">{formatDate(r.date)}</td>
                {showProject && (
                  <td tabIndex={0} className="tap-full truncate py-2 pr-4 text-slate-700 print:py-0.5" title={r.project}>
                    {r.project}
                  </td>
                )}
                <td className="sticky-col truncate py-2 pr-4 text-slate-700 print:py-0.5" title={r.vendor ?? undefined}>{r.vendor}</td>
                <td className="truncate py-2 pr-4 text-slate-700 print:py-0.5">
                  {r.item}
                  {r.unsettled && (
                    <Badge variant="amber" className="ml-2 align-middle print:hidden">
                      외상 미정산
                    </Badge>
                  )}
                </td>
                <td
                  title={r.category}
                  className={`truncate py-2 pr-4 print:py-0.5 ${r.category === "미분류" ? "text-red-600" : "text-slate-700"}`}
                  style={r.category === "미분류" ? undefined : { color: r.categoryColor }}
                >
                  {r.category}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-900 print:py-0.5">{formatWon(r.amount)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={(showProject ? 6 : 5) + (canEdit ? 1 : 0)} className="py-6 text-center text-slate-400">
                  매입 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
