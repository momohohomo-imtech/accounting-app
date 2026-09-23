"use client";

import { useMemo, useState } from "react";
import { formatWon, moneyClass } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Table, THead, Th, Tr, Td } from "@/components/ui/Table";

export type VatQuarterRow = {
  q: number;
  salesVat: number;
  purchaseVat: number;
  nonDeductibleVat: number;
  net: number;
};

type SortKey = keyof VatQuarterRow;

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "q", label: "분기" },
  { key: "salesVat", label: "매출세액", className: "text-right" },
  { key: "purchaseVat", label: "공제 매입세액", className: "text-right" },
  { key: "nonDeductibleVat", label: "불공제 매입세액", className: "text-right" },
  { key: "net", label: "납부(−환급) 예상", className: "text-right" },
];

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("font-mono", moneyClass(value), className)}>{formatWon(value)}</span>;
}

// 대시보드 분기별 부가세 표 — 합계 행은 정렬과 무관하게 항상 맨 아래.
export function VatQuarterTable({ rows, total }: { rows: VatQuarterRow[]; total: Omit<VatQuarterRow, "q"> }) {
  const [sortKey, setSortKey] = useState<SortKey>("q");
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
    const copy = [...rows];
    copy.sort((a, b) => (sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <Table className="min-w-[620px]">
      <THead>
        {COLUMNS.map((c, i) => (
          <Th key={c.key} className={cx(i < COLUMNS.length - 1 && "pr-4", c.className)}>
            <button
              type="button"
              onClick={() => handleSort(c.key)}
              className="inline-flex items-center gap-1 transition-colors hover:text-slate-800"
            >
              {c.label}
              {sortKey === c.key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
            </button>
          </Th>
        ))}
      </THead>
      <tbody>
        {sorted.map((v) => (
          <Tr key={v.q}>
            <Td className="pr-4">
              {v.q}분기 <span className="text-xs text-slate-400">({(v.q - 1) * 3 + 1}~{v.q * 3}월)</span>
            </Td>
            <Td className="pr-4 text-right">
              <Money value={v.salesVat} />
            </Td>
            <Td className="pr-4 text-right">
              <Money value={v.purchaseVat} />
            </Td>
            <Td className="pr-4 text-right text-slate-400">
              <Money value={v.nonDeductibleVat} />
            </Td>
            <Td className="text-right font-semibold">
              <Money value={v.net} />
            </Td>
          </Tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300 font-semibold">
          <td className="py-2 pr-4">합계</td>
          <td className="py-2 pr-4 text-right">
            <Money value={total.salesVat} />
          </td>
          <td className="py-2 pr-4 text-right">
            <Money value={total.purchaseVat} />
          </td>
          <td className="py-2 pr-4 text-right text-slate-400">
            <Money value={total.nonDeductibleVat} />
          </td>
          <td className="py-2 text-right">
            <Money value={total.net} />
          </td>
        </tr>
      </tfoot>
    </Table>
  );
}
