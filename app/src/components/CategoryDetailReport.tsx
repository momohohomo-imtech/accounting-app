"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatWon, formatDate } from "@/lib/format";
import { CategoryReportActions } from "@/components/CategoryReportActions";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { projectStatusLabel } from "@/lib/projectStatus";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { updateAgencyPurchase } from "@/lib/actions/projectAgencyPurchases";

type Category = { id: string; name: string; project_only: boolean; color: string | null };

type DetailRow = {
  id: string;
  kind: "매입" | "대행구매";
  trans_date: string | null;
  client_name: string | null;
  project_name: string | null;
  project_status: string | null;
  item_name: string | null;
  amount: number;
  category_id?: string | null;
  memo?: string | null;
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

// 대행구매 항목은 별도 테이블(project_agency_purchases)이라 매입(거래) 항목처럼
// 전용 수정 팝업으로 보내는 대신, 이 행 자체를 인라인 편집 폼으로 바꿔서 처리함
// (ProjectAgencyPurchaseList의 AgencyRow와 같은 방식).
function AgencyDetailRow({ row, categories, clientNames }: { row: DetailRow; categories: Category[]; clientNames: string[] }) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [clientName, setClientName] = useState(row.client_name ?? "");
  const [itemName, setItemName] = useState(row.item_name ?? "");
  const [categoryId, setCategoryId] = useState(row.category_id ?? "");
  const [amount, setAmount] = useState(String(row.amount));
  const [memo, setMemo] = useState(row.memo ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    const fd = new FormData();
    fd.append("id", row.id);
    fd.append("item_name", itemName);
    fd.append("amount", amount);
    fd.append("category_id", categoryId);
    fd.append("memo", memo);
    fd.append("client_name", clientName);
    const result = await pending.run(() => updateAgencyPurchase(fd));
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50 align-top last:border-0">
        <td className="py-2 pr-4 text-slate-500">대행구매</td>
        <td className="py-2 pr-4 text-slate-400">-</td>
        <td className="py-2 pr-4">
          <input
            list={`category-agency-clients-${row.id}`}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={`${fieldClass} w-full`}
          />
          <datalist id={`category-agency-clients-${row.id}`}>
            {clientNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </td>
        <td className="py-2 pr-4 text-slate-700">
          {row.project_name ?? <span className="font-medium text-red-600">일반경비</span>}
        </td>
        <td className="py-2 pr-4">
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="품목명"
            className={`${fieldClass} w-full`}
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${fieldClass} mt-1 w-full text-xs`}
          >
            <option value="">미분류</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} style={{ color: resolveCategoryColor(c) }}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모"
            className={`${fieldClass} mt-1 w-full text-xs`}
          />
        </td>
        <td className="py-2 pr-4 text-right">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="1"
            className={`${fieldClass} w-full text-right`}
          />
        </td>
        <td className="py-2 text-right print:hidden">
          <div className="flex justify-end gap-1">
            <Button size="xs" type="button" onClick={save}>
              저장
            </Button>
            <Button variant="secondary" size="xs" type="button" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-4">
        <span className="text-slate-500">대행구매</span>
      </td>
      <td className="py-2 pr-4 text-slate-600">-</td>
      <td className="py-2 pr-4 text-slate-700">{row.client_name ?? "-"}</td>
      <td className="py-2 pr-4 text-slate-700">
        {row.project_name ?? <span className="font-medium text-red-600">일반경비</span>}
      </td>
      <td className="py-2 pr-4 text-slate-700">{row.item_name ?? "-"}</td>
      <td className="py-2 pr-4 text-right font-mono text-slate-900">{formatWon(row.amount)}</td>
      <td className="py-2 text-right print:hidden">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          수정
        </button>
      </td>
    </tr>
  );
}

export function CategoryDetailReport({
  categoryName,
  year,
  purchaseRows,
  agencyRows,
  categories,
  clientNames,
  closeHref,
}: {
  categoryName: string;
  year: number;
  purchaseRows: DetailRow[];
  agencyRows: DetailRow[];
  categories: Category[];
  clientNames: string[];
  closeHref: string;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("");
  useEscapeKey(true, () => router.push(closeHref, { scroll: false }));

  function editHrefFor(id: string) {
    return `/reports?year=${year}&category=${encodeURIComponent(categoryName)}&editTx=${id}`;
  }

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set([...purchaseRows, ...agencyRows].map((r) => r.project_status).filter((v): v is string => Boolean(v)))
      ).sort((a, b) => a.localeCompare(b)),
    [purchaseRows, agencyRows]
  );
  const filteredPurchaseRows = useMemo(
    () => (statusFilter ? purchaseRows.filter((r) => r.project_status === statusFilter) : purchaseRows),
    [purchaseRows, statusFilter]
  );
  const filteredAgencyRows = useMemo(
    () => (statusFilter ? agencyRows.filter((r) => r.project_status === statusFilter) : agencyRows),
    [agencyRows, statusFilter]
  );
  const combined = useMemo(
    () => [...filteredPurchaseRows, ...filteredAgencyRows],
    [filteredPurchaseRows, filteredAgencyRows]
  );
  const purchaseTotal = filteredPurchaseRows.reduce((s, r) => s + r.amount, 0);
  const agencyTotal = filteredAgencyRows.reduce((s, r) => s + r.amount, 0);
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
              <th className="pb-2 pr-4 text-right">{headerButton("amount", "금액")}</th>
              <th className="pb-2 text-right print:hidden">관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) =>
              r.kind === "대행구매" ? (
                <AgencyDetailRow key={`${r.kind}-${r.id}`} row={r} categories={categories} clientNames={clientNames} />
              ) : (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4">
                    <span className="text-slate-700">{r.kind}</span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{r.trans_date ? formatDate(r.trans_date) : "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.client_name ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    {r.project_name ?? <span className="font-medium text-red-600">일반경비</span>}
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{r.item_name ?? "-"}</td>
                  <td className="py-2 pr-4 text-right font-mono text-slate-900">{formatWon(r.amount)}</td>
                  <td className="py-2 text-right print:hidden">
                    <Link
                      href={editHrefFor(r.id)}
                      className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                      수정
                    </Link>
                  </td>
                </tr>
              )
            )}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">
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
