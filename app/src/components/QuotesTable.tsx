"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteQuoteRecord } from "@/lib/actions/quotes";
import { formatWon, formatDate } from "@/lib/format";
import { quoteStatusLabel } from "@/lib/quoteStatus";
import { Button, LinkButton } from "@/components/ui/Button";

export type QuoteRow = {
  id: string;
  quote_number: string | null;
  title: string;
  clientName: string | null;
  projectLabel: string | null;
  status: string;
  total: number;
  created_at: string;
};

type SortKey = "quote_number" | "title" | "clientName" | "status" | "total" | "created_at";

function sortValue(r: QuoteRow, key: SortKey): string | number {
  switch (key) {
    case "quote_number":
      return r.quote_number ?? "";
    case "title":
      return r.title;
    case "clientName":
      return r.clientName ?? "";
    case "status":
      return quoteStatusLabel(r.status);
    case "total":
      return r.total;
    case "created_at":
      return r.created_at;
  }
}

export function QuotesTable({ rows }: { rows: QuoteRow[] }) {
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
            <th className="pb-2 pr-4">{headerButton("quote_number", "견적번호")}</th>
            <th className="pb-2 pr-4">{headerButton("title", "제목")}</th>
            <th className="pb-2 pr-4">{headerButton("clientName", "거래처")}</th>
            <th className="pb-2 pr-4">연결 프로젝트</th>
            <th className="pb-2 pr-4">{headerButton("status", "상태")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("total", "합계")}</th>
            <th className="pb-2 pr-4">{headerButton("created_at", "작성일")}</th>
            <th className="pb-2 text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((q) => (
            <tr key={q.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 font-mono text-slate-500">
                <Link href={`/quotes/${q.id}/edit`} className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
                  {q.quote_number ?? "-"}
                </Link>
              </td>
              <td className="py-2 pr-4 text-slate-700">{q.title}</td>
              <td className="py-2 pr-4 text-slate-700">{q.clientName ?? "-"}</td>
              <td className="py-2 pr-4 text-slate-500">{q.projectLabel ?? "-"}</td>
              <td className="py-2 pr-4 text-slate-700">{quoteStatusLabel(q.status)}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-900">{formatWon(q.total)}</td>
              <td className="py-2 pr-4 text-slate-500">{formatDate(q.created_at)}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <LinkButton href={`/quotes/${q.id}/edit`} variant="secondary" size="xs">
                    수정
                  </LinkButton>
                  {confirmDeleteId === q.id ? (
                    <form action={deleteQuoteRecord} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={q.id} />
                      <Button variant="danger" size="xs" type="submit">
                        확인
                      </Button>
                      <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                        취소
                      </Button>
                    </form>
                  ) : (
                    <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(q.id)}>
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
                작성된 견적서가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
