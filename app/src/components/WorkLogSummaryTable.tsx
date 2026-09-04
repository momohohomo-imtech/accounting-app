"use client";

import { useMemo, useState } from "react";
import type { WorkLogSummaryRow } from "@/lib/workLogSummary";
import { WorkLogGroupDetailPopup } from "@/components/WorkLogGroupDetailPopup";
import { setWorkLogSummaryCheck } from "@/lib/actions/workLogSummaryChecks";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type SortKey = "siteName" | "title" | "days" | "dates";

function sortValue(r: WorkLogSummaryRow, key: SortKey): string | number {
  switch (key) {
    case "siteName":
      return r.siteName;
    case "title":
      return r.title;
    case "days":
      return r.days;
    case "dates":
      return r.dates[0] ?? "";
  }
}

function formatMonthDay(dateKey: string) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function WorkLogSummaryTable({
  rows,
  emptyMessage,
  year,
  initialChecked = [],
}: {
  rows: WorkLogSummaryRow[];
  emptyMessage: string;
  year: number;
  initialChecked?: string[];
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openGroup, setOpenGroup] = useState<WorkLogSummaryRow | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const pending = useGlobalPending();

  // 체크는 화면에 바로 반영(낙관적 업데이트)하고 저장 요청은 뒤에서 보냄 — 실패하면
  // 원래 상태로 되돌림. 서버 저장 덕분에 다음에 다시 열어도 체크 상태가 유지됨.
  // 저장 요청 중에는 화면 전체를 잠가서 중복 클릭/다른 화면 이동으로 인한 문제를 막음.
  async function toggleChecked(key: string) {
    const willBeChecked = !checked.has(key);
    setChecked((prev) => {
      const next = new Set(prev);
      if (willBeChecked) next.add(key);
      else next.delete(key);
      return next;
    });
    const result = await pending.run(() => setWorkLogSummaryCheck(year, key, willBeChecked));
    if (result?.error) {
      setChecked((prev) => {
        const next = new Set(prev);
        if (willBeChecked) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    // 휴무/사내/기타는 어떤 열로 정렬하든 항상 맨 아래 고정.
    const normal = rows.filter((r) => !r.isSpecial);
    const special = rows.filter((r) => r.isSpecial);
    if (sortKey) {
      normal.sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return [...normal, ...special];
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
      <table className="w-full min-w-[650px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-2 pr-2 w-6" />
            <th className="pb-2 pr-4">{headerButton("siteName", "현장")}</th>
            <th className="pb-2 pr-4">{headerButton("title", "내용")}</th>
            <th className="pb-2 pr-4 text-right">{headerButton("days", "일수")}</th>
            <th className="pb-2">{headerButton("dates", "날짜")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const key = `${r.siteId}::${r.title}`;
            const isChecked = checked.has(key);
            return (
              <tr key={key} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChecked(key)}
                    className="h-3.5 w-3.5"
                  />
                </td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.siteColor }} />
                    {r.siteName}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(r)}
                    className={`text-left underline decoration-slate-300 underline-offset-2 hover:text-slate-900 ${
                      isChecked ? "text-slate-400 line-through" : "text-slate-700"
                    }`}
                  >
                    {r.title}
                  </button>
                </td>
                <td className="py-2 pr-4 text-right font-mono text-slate-900">{r.days}일</td>
                <td className="py-2 text-xs text-slate-500">{r.dates.map(formatMonthDay).join(", ")}</td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {openGroup && (
        <WorkLogGroupDetailPopup
          year={year}
          siteId={openGroup.siteId}
          siteName={openGroup.siteName}
          siteColor={openGroup.siteColor}
          title={openGroup.title}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}
