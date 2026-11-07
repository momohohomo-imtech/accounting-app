"use client";

import { useMemo, useState } from "react";
import { SQL_STATE_LABEL, type SqlState } from "@/lib/sqlStatus";
import { cx } from "@/lib/cx";

// 백업 화면 "SQL 실행 상태" 표(사용자 요청 11/7) — 기본은 SQL 번호 순(실행도 작은 번호부터), 머리글을 누르면 그 칸으로 정렬.
// 칸 순서: 번호 · 상태 · 기능(휴대폰에서 옆으로 넘기지 않아도 상태가 보이게).
type Row = { file: string; feature: string; state: SqlState };
type SortKey = "file" | "feature" | "state";

const STATE_ORDER: Record<SqlState, number> = { needed: 0, unknown: 1, done: 2 };
const STATE_CLASS: Record<SqlState, string> = {
  done: "text-emerald-700",
  needed: "font-semibold text-red-700",
  unknown: "text-amber-700",
};

export function SqlStatusTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("file");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp =
        sortKey === "state"
          ? STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.file.localeCompare(b.file)
          : a[sortKey].localeCompare(b[sortKey], "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="whitespace-nowrap pb-2 pr-4">{headerButton("file", "SQL")}</th>
            <th className="whitespace-nowrap pb-2 pr-4">{headerButton("state", "상태")}</th>
            <th className="pb-2">{headerButton("feature", "기능")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.file} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap py-1.5 pr-4 tabular-nums text-slate-700">{r.file}</td>
              {/* 상태를 번호 바로 옆에 — 휴대폰에선 표 칸이 한 줄이라 긴 기능 이름 뒤에 두면 옆으로 넘겨야 보였음 */}
              <td className={cx("whitespace-nowrap py-1.5 pr-4", STATE_CLASS[r.state])}>{SQL_STATE_LABEL[r.state]}</td>
              <td className="py-1.5 text-slate-700">{r.feature}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
