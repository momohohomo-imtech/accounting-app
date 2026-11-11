"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatWon, formatDate } from "@/lib/format";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { paymentMethodColorStyle } from "@/lib/paymentMethodColors";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { projectStatusLabel } from "@/lib/projectStatus";
import { PopupCloseLink } from "@/components/PopupCloseLink";
import { closePopup } from "@/lib/popupNavigation";
import { ReportBulkEditBar } from "@/components/ReportBulkEditBar";
import { useRowSelection } from "@/lib/useRowSelection";

type SiteDetailRow = {
  id: string;
  kind: "매출" | "매입";
  trans_date: string | null;
  project_name: string | null;
  project_status: string | null;
  item_name: string | null;
  amount: number;
  category_name: string | null;
  category_project_only: boolean;
  category_color: string | null;
  payment_method_name: string | null;
  payment_method_text_color: string | null;
  payment_method_background_color: string | null;
};

type SortKey = "trans_date" | "project_name" | "item_name" | "amount";

function sortValue(r: SiteDetailRow, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return r.trans_date ?? "";
    case "project_name":
      return r.project_name ?? "";
    case "item_name":
      return r.item_name ?? "";
    case "amount":
      return r.amount;
  }
}

// canEdit(관리자·직원): 보이는 매출·매입을 체크해서 프로젝트·거래처·카테고리·결제방식·품목을 한 번에(11/11, ReportBulkEditBar).
export function SiteProfitReport({
  siteName,
  year,
  rows,
  closeHref,
  canEdit = false,
}: {
  siteName: string;
  year: number;
  rows: SiteDetailRow[];
  closeHref: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [kindFilter, setKindFilter] = useState<"" | "매출" | "매입">("");
  const [statusFilter, setStatusFilter] = useState("");
  useEscapeKey(true, () => closePopup(router, closeHref));

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.project_status).filter((v): v is string => Boolean(v)))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [rows]
  );

  const filteredRows = useMemo(
    () => rows.filter((r) => (!kindFilter || r.kind === kindFilter) && (!statusFilter || r.project_status === statusFilter)),
    [rows, kindFilter, statusFilter]
  );

  const salesTotal = filteredRows.filter((r) => r.kind === "매출").reduce((s, r) => s + r.amount, 0);
  const purchaseTotal = filteredRows.filter((r) => r.kind === "매입").reduce((s, r) => s + r.amount, 0);
  const profit = salesTotal - purchaseTotal;

  function editHrefFor(id: string) {
    return `/reports?year=${year}&siteReport=${encodeURIComponent(siteName)}&editTx=${id}`;
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  const selection = useRowSelection(useMemo(() => sortedRows.map((r) => r.id), [sortedRows]));

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
          {siteName} 현장 내역서 <span className="tabular-nums text-sm font-normal text-slate-400">{year}년</span>
        </h2>
        <div className="flex items-center gap-3 max-md:flex-wrap print:hidden">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "" | "매출" | "매입")}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          >
            <option value="">매출/매입 전체</option>
            <option value="매출">매출만</option>
            <option value="매입">매입만</option>
          </select>
          {statusOptions.length > 0 && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
            >
              <option value="">프로젝트 상태 전체</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {projectStatusLabel(s)}
                </option>
              ))}
            </select>
          )}
          <PopupCloseLink href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </PopupCloseLink>
        </div>
      </div>

      {canEdit && selection.chosen.length > 0 && (
        <ReportBulkEditBar selectedIds={selection.chosen} onDone={selection.clear} onClear={selection.clear} />
      )}

      <div className="overflow-x-auto">
        <table className="sticky-col-table w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {canEdit && (
                <th className="w-8 pb-2 pr-2 print:hidden">
                  <input
                    type="checkbox"
                    aria-label="보이는 내역 전체 선택"
                    checked={selection.allOn}
                    onChange={selection.toggleAll}
                    className="h-4 w-4 accent-slate-900"
                  />
                </th>
              )}
              <th className="pb-2 pr-4">구분</th>
              <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
              <th className="pb-2 pr-4">{headerButton("project_name", "프로젝트")}</th>
              <th className="pb-2 pr-4">카테고리</th>
              <th className="sticky-col pb-2 pr-4">{headerButton("item_name", "품목")}</th>
              <th className="pb-2 pr-4">결제방식</th>
              <th className="pb-2 pr-4 text-right">{headerButton("amount", "금액")}</th>
              <th className="pb-2 text-right print:hidden">관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={`${r.kind}-${r.id}`}
                className={`border-b border-slate-100 last:border-0 ${selection.selected.has(r.id) ? "bg-brand-soft" : ""}`}
              >
                {canEdit && (
                  <td className="py-2 pr-2 print:hidden">
                    <input
                      type="checkbox"
                      aria-label={`${r.item_name ?? r.kind} 선택`}
                      checked={selection.selected.has(r.id)}
                      onChange={() => selection.toggle(r.id)}
                      className="h-4 w-4 accent-slate-900"
                    />
                  </td>
                )}
                <td className="py-2 pr-4">
                  <span className={r.kind === "매입" ? "text-slate-500" : "text-slate-700"}>{r.kind}</span>
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{r.trans_date ? formatDate(r.trans_date) : "-"}</td>
                <td className="py-2 pr-4 text-slate-700">
                  {r.project_name ?? <span className="font-medium text-red-600">일반경비</span>}
                </td>
                <td
                  className={`py-2 pr-4 ${r.category_project_only ? "font-medium" : "text-slate-700"}`}
                  style={{ color: resolveCategoryColor({ color: r.category_color, project_only: r.category_project_only }) }}
                >
                  {r.category_name ?? "-"}
                </td>
                <td
                  tabIndex={0}
                  title={r.item_name ?? undefined}
                  className="tap-full sticky-col py-2 pr-4 text-slate-700 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:whitespace-normal print:overflow-visible"
                >
                  {r.item_name ?? "-"}
                </td>
                <td className="py-2 pr-4">
                  {r.payment_method_name ? (
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      style={paymentMethodColorStyle({
                        text_color: r.payment_method_text_color,
                        background_color: r.payment_method_background_color,
                      })}
                    >
                      {r.payment_method_name}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-slate-900">{formatWon(r.amount)}</td>
                <td className="py-2 text-right print:hidden">
                  <Link
                    href={editHrefFor(r.id)}
                    className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                  >
                    수정
                  </Link>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 9 : 8} className="py-6 text-center text-slate-400">
                  내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-6 border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-600">
          매출 합계 <span className="ml-2 tabular-nums text-lg font-bold text-slate-900">{formatWon(salesTotal)}</span>
        </span>
        <span className="text-sm text-slate-600">
          매입 합계 <span className="ml-2 tabular-nums text-lg font-bold text-slate-900">{formatWon(purchaseTotal)}</span>
        </span>
        <span className="text-sm font-semibold text-slate-900">
          손익 <span className="ml-2 tabular-nums text-xl font-bold text-slate-900">{formatWon(profit)}</span>
        </span>
      </div>
    </div>
  );
}
