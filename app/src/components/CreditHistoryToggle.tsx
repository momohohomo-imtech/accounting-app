"use client";

import { useMemo, useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fieldClass } from "@/components/ui/field";

export type SettlementHistoryItem = { item_name: string | null; trans_date: string; amount: number; project_name: string | null };
export type SettlementHistoryGroup = {
  id: string;
  clientLabel: string;
  trans_date: string;
  methodName: string | null;
  total: number;
  items: SettlementHistoryItem[];
};

export function CreditHistoryToggle({ groups }: { groups: SettlementHistoryGroup[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const years = useMemo(
    () => Array.from(new Set(groups.map((g) => g.trans_date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [groups]
  );

  const filtered = useMemo(
    () =>
      groups.filter((g) => {
        if (year !== "all" && g.trans_date.slice(0, 4) !== year) return false;
        if (month !== "all" && g.trans_date.slice(5, 7) !== month) return false;
        return true;
      }),
    [groups, year, month]
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
        >
          {open ? "정산 이력 숨기기" : `정산 이력 보기 (${groups.length}건)`}
        </button>
        {open && (
          <div className="flex gap-2 print:hidden">
            <select value={year} onChange={(e) => setYear(e.target.value)} className={fieldClass}>
              <option value="all">전체 연도</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={fieldClass}>
              <option value="all">전체 월</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                <option key={m} value={m}>
                  {Number(m)}월
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {filtered.map((g) => (
            <Card key={g.id} padding="md">
              <CardHeader className="mb-2">
                <div>
                  <CardTitle className="text-sm">{g.clientLabel}</CardTitle>
                  <p className="text-xs text-slate-500">
                    {formatDate(g.trans_date)} · {g.methodName ?? "-"} · <Badge variant="emerald">세금계산서 발행</Badge>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">{formatWon(g.total)}</span>
                  <button
                    type="button"
                    onClick={() => toggleExpand(g.id)}
                    className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                  >
                    {expanded.has(g.id) ? "품목 접기" : `품목 ${g.items.length}건 보기`}
                  </button>
                </div>
              </CardHeader>
              {expanded.has(g.id) && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  {g.items.map((it, i) => (
                    <li key={i} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="w-24 shrink-0 text-slate-500">{formatDate(it.trans_date)}</span>
                      <span className="w-28 shrink-0 truncate text-slate-500">{it.project_name ?? "일반경비"}</span>
                      <span className="flex-1 truncate text-slate-700">{it.item_name ?? "-"}</span>
                      <span className="shrink-0 text-slate-900">{formatWon(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-400">정산 이력이 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
