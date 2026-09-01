"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatWon, formatDate } from "@/lib/format";
import { VendorReportActions } from "@/components/VendorReportActions";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { useEscapeKey } from "@/lib/useEscapeKey";

type VendorRow = {
  id: string;
  kind: "매입" | "대행구매";
  trans_date: string | null;
  item_name: string | null;
  amount: number;
  project_name: string | null;
  needs_classification: boolean;
  category_name: string | null;
  category_project_only: boolean;
  category_color: string | null;
  payment_method_name: string | null;
};

type SortKey = "trans_date" | "project_name" | "item_name" | "amount";

function sortValue(r: VendorRow, key: SortKey): string | number {
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

export function VendorDetailReport({
  vendorName,
  year,
  rows,
  closeHref,
  vendorAgency,
}: {
  vendorName: string;
  year: number;
  rows: VendorRow[];
  closeHref: string;
  vendorAgency?: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showProject, setShowProject] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("");
  useEscapeKey(true, () => router.push(closeHref));
  const [showItem, setShowItem] = useState(true);

  const hasAgency = rows.some((r) => r.kind === "대행구매");
  const paymentMethodOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.payment_method_name).filter((v): v is string => Boolean(v)))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [rows]
  );

  const filteredRows = useMemo(
    () => (paymentFilter ? rows.filter((r) => r.payment_method_name === paymentFilter) : rows),
    [rows, paymentFilter]
  );
  const total = filteredRows.reduce((s, r) => s + r.amount, 0);

  function editHrefFor(id: string) {
    return `/reports?year=${year}${vendorAgency ? "&vendorAgency=1" : ""}&vendor=${encodeURIComponent(vendorName)}&editTx=${id}`;
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

  // 엑셀 다운로드가 화면에 보이는(정렬·구분/프로젝트/카테고리/품목 토글 반영) 내용과 항상 똑같게,
  // 인쇄 테이블과 동일한 컬럼 구성 + 정렬 순서(sortedRows)로 내보낸다.
  const exportHeaders = [
    ...(hasAgency ? ["구분"] : []),
    "날짜",
    ...(showProject ? ["프로젝트"] : []),
    ...(showCategory ? ["카테고리"] : []),
    ...(showPayment ? ["결제방식"] : []),
    ...(showItem ? ["품목"] : []),
    "금액",
  ];
  const exportRows = sortedRows.map((r) => [
    ...(hasAgency ? [r.kind] : []),
    r.trans_date ? formatDate(r.trans_date) : "-",
    ...(showProject ? [r.needs_classification ? "분류 대기 중" : (r.project_name ?? "일반경비")] : []),
    ...(showCategory ? [r.category_name ?? "-"] : []),
    ...(showPayment ? [r.payment_method_name ?? "-"] : []),
    ...(showItem ? [r.item_name ?? "-"] : []),
    r.amount,
  ]);

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
          {vendorName} {hasAgency ? "매입/대행구매 내역" : "매입 내역"}{" "}
          <span className="font-mono text-sm font-normal text-slate-400">{year}년</span>
        </h2>
        <div className="flex items-center gap-3 print:hidden">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showProject} onChange={(e) => setShowProject(e.target.checked)} className="h-3.5 w-3.5" />
            프로젝트
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} className="h-3.5 w-3.5" />
            카테고리
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showItem} onChange={(e) => setShowItem(e.target.checked)} className="h-3.5 w-3.5" />
            품목
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showPayment} onChange={(e) => setShowPayment(e.target.checked)} className="h-3.5 w-3.5" />
            결제방식
          </label>
          {paymentMethodOptions.length > 0 && (
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
            >
              <option value="">결제방식 전체</option>
              {paymentMethodOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <VendorReportActions vendorName={vendorName} year={year} headers={exportHeaders} rows={exportRows} total={total} />
          <Link href={closeHref} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {hasAgency && <th className="pb-2 pr-4">구분</th>}
              <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
              {showProject && <th className="pb-2 pr-4">{headerButton("project_name", "프로젝트")}</th>}
              {showCategory && <th className="pb-2 pr-4">카테고리</th>}
              {showPayment && <th className="pb-2 pr-4">결제방식</th>}
              {showItem && <th className="pb-2 pr-4">{headerButton("item_name", "품목")}</th>}
              <th className="pb-2 text-right">{headerButton("amount", "금액")}</th>
              <th className="pb-2 pl-4 text-right print:hidden">관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                {hasAgency && (
                  <td className="py-2 pr-4">
                    <span className={r.kind === "대행구매" ? "text-slate-500" : "text-slate-700"}>{r.kind}</span>
                  </td>
                )}
                <td className="py-2 pr-4 text-slate-600">{r.trans_date ? formatDate(r.trans_date) : "-"}</td>
                {showProject && (
                  <td className="py-2 pr-4 text-slate-700">
                    {r.needs_classification ? (
                      <span className="inline-flex rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                        분류 대기 중
                      </span>
                    ) : (
                      (r.project_name ?? <span className="font-medium text-red-600">일반경비</span>)
                    )}
                  </td>
                )}
                {showCategory && (
                  <td
                    className={`py-2 pr-4 ${r.category_project_only ? "font-medium" : "text-slate-700"}`}
                    style={{ color: resolveCategoryColor({ color: r.category_color, project_only: r.category_project_only }) }}
                  >
                    {r.category_name ?? "-"}
                  </td>
                )}
                {showPayment && <td className="py-2 pr-4 text-slate-700">{r.payment_method_name ?? "-"}</td>}
                {showItem && <td className="py-2 pr-4 text-slate-700">{r.item_name ?? "-"}</td>}
                <td className="py-2 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
                <td className="py-2 pl-4 text-right print:hidden">
                  {r.kind === "매입" && (
                    <Link
                      href={editHrefFor(r.id)}
                      className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                      수정
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={
                    3 +
                    (hasAgency ? 1 : 0) +
                    (showProject ? 1 : 0) +
                    (showCategory ? 1 : 0) +
                    (showPayment ? 1 : 0) +
                    (showItem ? 1 : 0)
                  }
                  className="py-6 text-center text-slate-400"
                >
                  내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <span className="text-sm font-semibold text-slate-900">
          합계 <span className="ml-2 font-mono text-xl font-bold text-slate-900">{formatWon(total)}</span>
        </span>
      </div>
    </div>
  );
}
