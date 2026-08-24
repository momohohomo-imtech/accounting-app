"use client";

import { useState } from "react";
import { formatWon, formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900"
      >
        {open ? "정산 이력 숨기기" : `정산 이력 보기 (${groups.length}건)`}
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {groups.map((g) => (
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
          {groups.length === 0 && <p className="py-4 text-center text-sm text-slate-400">정산 이력이 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
