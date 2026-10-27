"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWon } from "@/lib/format";
import { LinkButton, Button } from "@/components/ui/Button";

// 카테고리 상세(보고서 팝업) 주소 — 여러 개면 category를 반복(이름에 쉼표가 들어갈 수 있어 한 칸에 이어 붙이지 않음).
export function categoryReportHref(year: number, names: string[]) {
  return `/reports?year=${year}&${names.map((n) => `category=${encodeURIComponent(n)}`).join("&")}`;
}

type CategoryAgg = { name: string; count: number; amount: number; color?: string };
type MergedRow = { name: string; count: number; amount: number; agencyCount: number; agencyAmount: number; color?: string };
type SortKey = "name" | "count" | "amount" | "agencyCount" | "agencyAmount";

function mergeRows(rows: CategoryAgg[], agencyRows: CategoryAgg[]): MergedRow[] {
  const map = new Map<string, MergedRow>();
  for (const r of rows) {
    map.set(r.name, { name: r.name, count: r.count, amount: r.amount, agencyCount: 0, agencyAmount: 0, color: r.color });
  }
  for (const a of agencyRows) {
    const existing = map.get(a.name);
    if (existing) {
      existing.agencyCount = a.count;
      existing.agencyAmount = a.amount;
      existing.color = existing.color ?? a.color;
    } else {
      map.set(a.name, { name: a.name, count: 0, amount: 0, agencyCount: a.count, agencyAmount: a.amount, color: a.color });
    }
  }
  return Array.from(map.values());
}

export function CategoryAggregateTable({
  rows,
  agencyRows = [],
  year,
}: {
  rows: CategoryAgg[];
  agencyRows?: CategoryAgg[];
  year: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // 체크한 카테고리 — "선택한 카테고리 보기"로 한 번에(사용자 요청). 이름을 누르면 지금처럼 그 카테고리 하나만.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const merged = useMemo(() => mergeRows(rows, agencyRows), [rows, agencyRows]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...merged];
    copy.sort((a, b) => {
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [merged, sortKey, sortDir]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === merged.length ? new Set() : new Set(merged.map((c) => c.name))));
  }

  // 선택한 카테고리를 표에 보이는 순서대로.
  const selectedNames = sorted.filter((c) => selected.has(c.name)).map((c) => c.name);

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
      <p className="mb-2 text-xs text-slate-400">
        대행구매액은 프로젝트 손익보고서에 참고용으로만 기록되는 금액으로, 매입장(매입 합계)과는 별개예요. 카테고리를
        클릭하면 상세 내역을, 여러 개를 체크하면 한 번에 볼 수 있어요.
      </p>
      {selectedNames.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm print:hidden">
          <span className="text-slate-600">{selectedNames.length}개 선택</span>
          <LinkButton href={categoryReportHref(year, selectedNames)} size="sm">
            선택한 카테고리 보기
          </LinkButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            선택 해제
          </Button>
        </div>
      )}
      <table className="sticky-col-table w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="w-8 pb-2 pr-2 print:hidden">
              <input
                type="checkbox"
                aria-label="카테고리 전체 선택"
                checked={merged.length > 0 && selected.size === merged.length}
                onChange={toggleAll}
                className="h-4 w-4 accent-slate-900"
              />
            </th>
            <th className="sticky-col pb-2 pr-4">{headerButton("name", "카테고리")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("count", "매입 건수")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("amount", "매입 합계")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("agencyCount", "대행구매 건수")}</th>
            <th className="pb-2 text-right">{headerButton("agencyAmount", "대행구매액 (프로젝트)")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.name} className={`border-b border-slate-100 last:border-0 ${selected.has(c.name) ? "bg-brand-soft" : ""}`}>
              <td className="py-2 pr-2 print:hidden">
                <input
                  type="checkbox"
                  aria-label={`${c.name} 선택`}
                  checked={selected.has(c.name)}
                  onChange={() => toggle(c.name)}
                  className="h-4 w-4 accent-slate-900"
                />
              </td>
              <td className="sticky-col py-2 pr-4">
                <Link
                  href={categoryReportHref(year, [c.name])}
                  className={`underline decoration-slate-300 underline-offset-2 hover:text-slate-900 print:no-underline ${
                    c.name === "미분류" ? "font-medium text-red-600" : "text-slate-700"
                  }`}
                  style={c.name === "미분류" ? undefined : { color: c.color }}
                >
                  {c.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{c.count}건</td>
              <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{formatWon(c.amount)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-slate-500">{c.agencyCount}건</td>
              <td className="py-2 text-right tabular-nums text-slate-500">
                {c.agencyAmount > 0 ? formatWon(c.agencyAmount) : "-"}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-slate-400">
                매입 거래가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
