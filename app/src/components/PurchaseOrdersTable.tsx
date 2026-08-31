"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deletePurchaseOrderRecord } from "@/lib/actions/purchaseOrders";
import { formatWon, formatDate } from "@/lib/format";
import { purchaseOrderStatusLabel } from "@/lib/purchaseOrderStatus";
import { Button, LinkButton } from "@/components/ui/Button";

export type PurchaseOrderRow = {
  id: string;
  po_number: string | null;
  title: string;
  clientName: string | null;
  projectLabel: string | null;
  status: string;
  total: number;
  created_at: string;
};

type SortKey = "po_number" | "title" | "clientName" | "status" | "total" | "created_at";

function sortValue(r: PurchaseOrderRow, key: SortKey): string | number {
  switch (key) {
    case "po_number":
      return r.po_number ?? "";
    case "title":
      return r.title;
    case "clientName":
      return r.clientName ?? "";
    case "status":
      return purchaseOrderStatusLabel(r.status);
    case "total":
      return r.total;
    case "created_at":
      return r.created_at;
  }
}

export function PurchaseOrdersTable({ rows }: { rows: PurchaseOrderRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" || key === "total" ? "desc" : "asc");
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
      <table className="w-full min-w-[750px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-4">{headerButton("po_number", "발주번호")}</th>
            <th className="pb-2 pr-4">{headerButton("title", "제목")}</th>
            <th className="pb-2 pr-4">{headerButton("clientName", "매입처")}</th>
            <th className="pb-2 pr-4">연결 프로젝트</th>
            <th className="pb-2 pr-4">{headerButton("status", "상태")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("total", "합계")}</th>
            <th className="pb-2 pr-4">{headerButton("created_at", "작성일")}</th>
            <th className="pb-2 text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((po) => (
            <tr key={po.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 font-mono text-slate-500">
                <Link
                  href={`/purchase-orders/${po.id}/edit`}
                  className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  {po.po_number ?? "-"}
                </Link>
              </td>
              <td className="py-2 pr-4 text-slate-700">{po.title}</td>
              <td className="py-2 pr-4 text-slate-700">{po.clientName ?? "-"}</td>
              <td className="py-2 pr-4 text-slate-500">{po.projectLabel ?? "-"}</td>
              <td className="py-2 pr-4 text-slate-700">{purchaseOrderStatusLabel(po.status)}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-900">{formatWon(po.total)}</td>
              <td className="py-2 pr-4 text-slate-500">{formatDate(po.created_at)}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <LinkButton href={`/purchase-orders/${po.id}/edit`} variant="secondary" size="xs">
                    수정
                  </LinkButton>
                  {confirmDeleteId === po.id ? (
                    <form action={deletePurchaseOrderRecord} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={po.id} />
                      <Button variant="danger" size="xs" type="submit">
                        확인
                      </Button>
                      <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </form>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(po.id)}>
                      삭제
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-400">
                작성된 발주서가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
