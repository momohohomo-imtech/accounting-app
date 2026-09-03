"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { Table, THead, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { updateTransactionNote } from "@/lib/actions/transactions";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type UsageRow = { id: string; trans_date: string; client_name: string; amount: number; project_name: string; note: string };

type SortKey = "trans_date" | "client_name" | "amount";

function NoteCell({ id, initialNote }: { id: string; initialNote: string }) {
  const [value, setValue] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const pending = useGlobalPending();

  async function handleBlur() {
    if (value === initialNote) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("id", id);
    fd.append("note1", value);
    await pending.run(() => updateTransactionNote(fd));
    setSaving(false);
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="비고 입력"
      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-slate-400 focus:bg-white focus:outline-none"
      title={saving ? "저장 중..." : undefined}
    />
  );
}

export function DailyWorkerUsageTable({ rows }: { rows: UsageRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>("trans_date");
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
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const byClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.client_name, (map.get(r.client_name) ?? 0) + r.amount);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

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
      <Table className="min-w-[600px]">
        <THead>
          <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
          <th className="pb-2 pr-4">{headerButton("client_name", "거래처")}</th>
          <th className="pb-2 pr-4 text-right">{headerButton("amount", "금액")}</th>
          <th className="pb-2 pr-4">프로젝트</th>
          <th className="pb-2">비고</th>
        </THead>
        <tbody>
          {sorted.map((r) => (
            <Tr key={r.id}>
              <Td className="pr-4">{formatDate(r.trans_date)}</Td>
              <Td className="pr-4">{r.client_name}</Td>
              <Td className="pr-4 text-right font-medium text-slate-900">{formatWon(r.amount)}</Td>
              <Td className="pr-4 text-slate-600">{r.project_name || "-"}</Td>
              <Td>
                <NoteCell id={r.id} initialNote={r.note} />
              </Td>
            </Tr>
          ))}
          {sorted.length === 0 && <EmptyRow colSpan={5}>일용직 사용 내역이 없습니다.</EmptyRow>}
        </tbody>
      </Table>

      {rows.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">거래처별 집계</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byClient.map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-600">{name}</span>
                <span className="font-mono font-semibold text-slate-900">{formatWon(amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span className="font-medium text-slate-500">전체 {rows.length}건</span>
            <span>
              전체 합계 <span className="font-mono font-semibold text-slate-900">{formatWon(total)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
