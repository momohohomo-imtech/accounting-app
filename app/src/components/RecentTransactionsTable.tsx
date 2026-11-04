"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, Th, Tr, Td, EmptyRow } from "@/components/ui/Table";

// 대시보드 "최근 등록 거래"(11/4 사용자 결정 — 거래일 순이 아니라 등록한 순서, 정산 전 외상도 "외상 미정산" 표시와 함께 보임: 예전엔
// 장부 표시 기준이라 방금 등록한 외상 거래가 안 보였음). 목록형 표라 머리글을 눌러 정렬(처음엔 등록 순 그대로).
export type RecentTxRow = {
  id: string;
  date: string;
  type: string;
  client: string;
  project: string;
  item: string;
  amount: number;
  unsettled: boolean;
};

type SortKey = "date" | "type" | "client" | "project" | "item" | "amount";

function sortValue(r: RecentTxRow, key: SortKey): string | number {
  switch (key) {
    case "date":
      return r.date;
    case "type":
      return r.type;
    case "client":
      return r.client;
    case "project":
      return r.project;
    case "item":
      return r.item;
    case "amount":
      return r.amount;
  }
}

export function RecentTransactionsTable({ rows }: { rows: RecentTxRow[] }) {
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

  // 원본(등록 순)은 그대로 두고 복사본만 정렬
  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
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
    <div className="[&_table]:text-xs [&_td]:py-1 [&_th]:pb-1">
      <Table className="min-w-[600px]">
        <THead>
          <Th className="pr-4">{headerButton("date", "거래일")}</Th>
          <Th className="pr-4">{headerButton("type", "구분")}</Th>
          <Th className="pr-4">{headerButton("client", "거래처")}</Th>
          <Th className="pr-4">{headerButton("project", "프로젝트")}</Th>
          <Th className="pr-4">{headerButton("item", "품목")}</Th>
          <Th className="text-right">{headerButton("amount", "금액")}</Th>
        </THead>
        <tbody>
          {sorted.map((t) => (
            <Tr key={t.id}>
              <Td className="pr-4">{formatDate(t.date)}</Td>
              <Td className="whitespace-nowrap pr-4">
                <Badge variant={t.type === "매출" ? "blue" : "orange"}>{t.type}</Badge>
                {t.unsettled && (
                  <Badge variant="amber" className="ml-1">
                    외상 미정산
                  </Badge>
                )}
              </Td>
              <Td className="pr-4">{t.client || "-"}</Td>
              <Td className="pr-4">{t.project || "-"}</Td>
              <Td className="pr-4">{t.item || "-"}</Td>
              <Td className="whitespace-nowrap text-right font-medium text-slate-900">{formatWon(t.amount)}</Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow colSpan={6}>등록된 거래가 없습니다.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
