"use client";

import { useMemo, useState } from "react";
import { deleteTransactionRecord } from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { transactionTotal } from "@/lib/credit";
import { Badge } from "@/components/ui/Badge";
import { LinkButton, Button } from "@/components/ui/Button";
import { Table, THead, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { cx } from "@/lib/cx";
import type { Transaction } from "@/lib/types";

type SortKey = "trans_date" | "type" | "client" | "project" | "item_name" | "payment_method" | "tax_invoice" | "amount";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "trans_date", label: "날짜" },
  { key: "type", label: "구분" },
  { key: "client", label: "거래처" },
  { key: "project", label: "프로젝트" },
  { key: "item_name", label: "품목" },
  { key: "payment_method", label: "결제방식" },
  { key: "tax_invoice", label: "세금계산서" },
  { key: "amount", label: "금액" },
];

function sortValue(t: Transaction, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return t.trans_date;
    case "type":
      return t.type;
    case "client":
      return t.clients?.name ?? t.client_name_raw ?? "";
    case "project":
      return t.projects?.name ?? "";
    case "item_name":
      return t.item_name ?? "";
    case "payment_method":
      return t.payment_methods?.name ?? "";
    case "tax_invoice":
      return t.tax_invoice_issued ? 1 : 0;
    case "amount":
      return transactionTotal(t);
  }
}

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("trans_date");
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
    const copy = [...transactions];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  return (
    <Table className="min-w-[980px]">
      <THead>
        {COLUMNS.map((c) => (
          <th key={c.key} className={cx("whitespace-nowrap pb-2 pr-4 font-medium", c.key === "amount" && "text-right")}>
            <button
              type="button"
              onClick={() => handleSort(c.key)}
              className="inline-flex items-center gap-1 transition-colors hover:text-slate-800"
            >
              {c.label}
              {sortKey === c.key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
          </th>
        ))}
        <th className="pb-2 text-right font-medium">관리</th>
      </THead>
      <tbody>
        {sorted.map((t) => (
          <Tr key={t.id}>
            <Td className="pr-4">{formatDate(t.trans_date)}</Td>
            <Td className="pr-4">
              <Badge variant={t.type === "매출" ? "blue" : "orange"}>{t.type}</Badge>
            </Td>
            <Td className="pr-4">{t.clients?.name ?? t.client_name_raw ?? "-"}</Td>
            <Td className="pr-4">{t.projects?.name ?? "일반경비"}</Td>
            <Td className="pr-4">{t.item_name ?? "-"}</Td>
            <Td className="pr-4">{t.payment_methods?.name ?? "-"}</Td>
            <Td className="pr-4">
              {t.tax_invoice_issued ? <Badge variant="emerald">발행</Badge> : <span className="text-slate-300">-</span>}
            </Td>
            <Td className="pr-4 text-right font-medium text-slate-900">{formatWon(transactionTotal(t))}</Td>
            <Td className="text-right">
              <div className="flex justify-end gap-2">
                <LinkButton href={`/transactions/${t.id}/edit`} variant="secondary" size="xs">
                  수정
                </LinkButton>
                <form action={deleteTransactionRecord}>
                  <input type="hidden" name="id" value={t.id} />
                  <Button variant="danger" size="xs">
                    삭제
                  </Button>
                </form>
              </div>
            </Td>
          </Tr>
        ))}
        {sorted.length === 0 && <EmptyRow colSpan={COLUMNS.length + 1}>거래 내역이 없습니다.</EmptyRow>}
      </tbody>
    </Table>
  );
}
