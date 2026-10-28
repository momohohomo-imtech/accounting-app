"use client";

import { useMemo, useState } from "react";
import { formatDate, formatWon } from "@/lib/format";
import { projectStatusLabel } from "@/lib/projectStatus";
import { moveProjectsToNextYear } from "@/lib/actions/projects";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

// 연말 점검 한 줄 = 세금계산서 미발행 묶음(어미 + 귀속 하위, 자기 상태가 있는 하위는 따로). memberIds = 귀속 연도를 함께
// 옮길 프로젝트(어미 줄이면 같은 묶음의 검토중 하위 reviewChildCount건 포함).
export type YearEndRow = {
  key: string;
  label: string;
  status: string;
  quote: number;
  agency: number;
  billed: number;
  remaining: number;
  lastBilled: string | null;
  memberIds: string[];
  reviewChildCount: number;
};
type SortKey = "label" | "status" | "quote" | "agency" | "billed" | "remaining" | "lastBilled";

export function YearEndCheckTable({ year, rows }: { year: number; rows: YearEndRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("remaining");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const pending = useGlobalPending();

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const value = (r: YearEndRow) => (sortKey === "status" ? projectStatusLabel(r.status) : (r[sortKey] ?? ""));
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const chosen = rows.filter((r) => selected.has(r.key));
  const projectIds = chosen.flatMap((r) => r.memberIds);

  async function handleMove() {
    const ok = await confirm(
      `선택한 ${chosen.length}건(프로젝트 ${projectIds.length}개)의 귀속 연도를 ${year + 1}년으로 옮길까요? 금액은 그대로이고, ` +
        `프로젝트 목록·대시보드·보고서에서 ${year + 1}년 프로젝트로 계산됩니다. 프로젝트 수정 화면에서 다시 바꿀 수 있어요.`,
      { confirmLabel: `${year + 1}년으로 옮기기` }
    );
    if (!ok) return;
    const result = await pending.run(() => moveProjectsToNextYear(projectIds, year));
    if (result?.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setSelected(new Set());
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        12월 31일까지 세금계산서를 다 발행하지 못할 프로젝트는 귀속 연도를 다음 해로 옮겨야 그 해 이익·세금 예상이 맞아요. 어미를
        옮기면 &quot;타 프로젝트 귀속&quot; 하위와 검토중인 하위도 같이 옮겨요(자기 상태로 따로 보이는 하위는 따로 고르고, 다
        발행했거나 수금 완료인 하위는 그 해에 남아요). 남은 발행 예정액 = 발주액 − 대행구매액 − 발행한 매출(공급가액).
      </p>
      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm print:hidden">
          <span className="text-slate-600">
            {chosen.length}건 선택 · 남은 발행 예정액 {formatWon(chosen.reduce((s, r) => s + r.remaining, 0))}
          </span>
          <Button type="button" size="sm" onClick={handleMove}>
            {year + 1}년으로 옮기기
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            선택 해제
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="sticky-col-table w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 pb-2 pr-2 print:hidden">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={() => setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.key))))}
                  className="h-4 w-4 accent-slate-900"
                />
              </th>
              <th className="sticky-col pb-2 pr-4 font-medium">{headerButton("label", "프로젝트")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 font-medium">{headerButton("status", "상태")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("quote", "발주액")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("agency", "대행구매")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("billed", "발행한 매출")}</th>
              <th className="whitespace-nowrap pb-2 pr-4 text-right font-medium">{headerButton("remaining", "남은 발행 예정액")}</th>
              <th className="whitespace-nowrap pb-2 font-medium">{headerButton("lastBilled", "마지막 발행일")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.key} className={`border-b border-slate-100 last:border-0 ${selected.has(r.key) ? "bg-brand-soft" : ""}`}>
                <td className="py-2 pr-2 print:hidden">
                  <input
                    type="checkbox"
                    aria-label={`${r.label} 선택`}
                    checked={selected.has(r.key)}
                    onChange={() => toggle(r.key)}
                    className="h-4 w-4 accent-slate-900"
                  />
                </td>
                <td
                  className="sticky-col py-2 pr-4 text-slate-800 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:whitespace-normal"
                  title={r.label}
                >
                  {r.label}
                  {r.reviewChildCount > 0 && (
                    <span className="block text-xs text-slate-400">검토중 하위 {r.reviewChildCount}건도 같이 옮김</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{projectStatusLabel(r.status)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-700">{formatWon(r.quote)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-500">
                  {r.agency > 0 ? formatWon(r.agency) : "-"}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-slate-700">
                  {r.billed > 0 ? formatWon(r.billed) : "-"}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums font-semibold text-slate-900">
                  {formatWon(r.remaining)}
                </td>
                <td className="whitespace-nowrap py-2 text-slate-500">{r.lastBilled ? formatDate(r.lastBilled) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
