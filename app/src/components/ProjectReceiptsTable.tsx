"use client";

import { useMemo, useState } from "react";
import { formatWon } from "@/lib/format";
import type { ReceiptStatus } from "@/lib/expectedReceivable";
import { Badge } from "@/components/ui/Badge";

export type ProjectReceiptRow = {
  id: string;
  date: string;
  item: string;
  projectLabel: string;
  client: string;
  total: number;
  received: number;
  status: ReceiptStatus;
  paidDate: string | null;
  taxInvoice: boolean;
};

type SortKey = "date" | "item" | "project" | "client" | "total" | "received" | "status" | "paidDate" | "taxInvoice";

const STATUS_ORDER: Record<ReceiptStatus, number> = { waiting: 0, partial: 1, received: 2 };
const STATUS_BADGE = {
  received: { label: "입금 완료", variant: "emerald" },
  partial: { label: "일부 입금", variant: "amber" },
  waiting: { label: "입금 대기", variant: "red" },
} as const;

function sortValue(r: ProjectReceiptRow, key: SortKey): string | number {
  switch (key) {
    case "status":
      return STATUS_ORDER[r.status];
    case "paidDate":
      return r.paidDate ?? "";
    case "taxInvoice":
      return r.taxInvoice ? 1 : 0;
    case "project":
      return r.projectLabel;
    default:
      return r[key];
  }
}

// 프로젝트 보고서(손익 보고서 팝업)의 "받은 돈 내역" — 그 프로젝트(묶음이면 귀속 하위까지)로 등록한 매출 계산서(선급금·중도금·
// 잔금·기성금)마다 금액·실제로 받은 돈(부가세 포함)·입금 상태·입금일. 계산은 lib/expectedReceivable.ts의 projectReceipts.
export function ProjectReceiptsTable({ rows, showProject }: { rows: ProjectReceiptRow[]; showProject: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return (sortDir === "asc" ? cmp : -cmp) || a.date.localeCompare(b.date);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px] print:hidden">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const textCell = "py-1 pr-3 print:py-0.5";
  const numCell = "whitespace-nowrap py-1 pr-3 text-right tabular-nums print:py-0.5";
  const longCell = "tap-full max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal";

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="sticky-col-table w-full min-w-[720px] text-sm print:min-w-0 print:text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-1 pr-3">{headerButton("date", "계산서 날짜")}</th>
            <th className="sticky-col pb-1 pr-3">{headerButton("item", "품목")}</th>
            {showProject && <th className="pb-1 pr-3">{headerButton("project", "프로젝트")}</th>}
            <th className="pb-1 pr-3">{headerButton("client", "거래처")}</th>
            <th className="pb-1 pr-3 text-right">{headerButton("total", "계산서 금액")}</th>
            <th className="pb-1 pr-3 text-right">{headerButton("received", "받은 돈")}</th>
            <th className="pb-1 pr-3">{headerButton("status", "입금 상태")}</th>
            <th className="pb-1 pr-3">{headerButton("paidDate", "입금일")}</th>
            <th className="pb-1">{headerButton("taxInvoice", "세금계산서")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const badge = STATUS_BADGE[r.status];
            return (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className={`${textCell} whitespace-nowrap tabular-nums text-slate-700`}>{r.date}</td>
                <td tabIndex={0} className={`sticky-col ${textCell} ${longCell} text-slate-900`} title={r.item}>
                  {r.item}
                </td>
                {showProject && (
                  <td tabIndex={0} className={`${textCell} ${longCell} text-slate-700`} title={r.projectLabel}>
                    {r.projectLabel}
                  </td>
                )}
                <td tabIndex={0} className={`${textCell} ${longCell} text-slate-700`} title={r.client}>
                  {r.client}
                </td>
                <td className={`${numCell} text-slate-900`}>{formatWon(r.total)}</td>
                <td className={`${numCell} font-semibold text-slate-900`}>{r.received > 0 ? formatWon(r.received) : "-"}</td>
                <td className={`${textCell} whitespace-nowrap`}>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {r.status === "partial" && (
                    <span className="ml-1 text-xs text-slate-500 print:text-[9px]">남은 {formatWon(r.total - r.received)}</span>
                  )}
                </td>
                <td className={`${textCell} whitespace-nowrap tabular-nums text-slate-600`}>{r.paidDate ?? "-"}</td>
                <td className="whitespace-nowrap py-1 text-slate-600 print:py-0.5">{r.taxInvoice ? "발행" : "-"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
            <td className={textCell}>합계</td>
            <td className={`sticky-col ${textCell} tabular-nums`}>{rows.length}건</td>
            {showProject && <td />}
            <td />
            <td className={numCell}>{formatWon(rows.reduce((s, r) => s + r.total, 0))}</td>
            <td className={numCell}>{formatWon(rows.reduce((s, r) => s + r.received, 0))}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
