"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatWon } from "@/lib/format";
import { projectStatusLabel } from "@/lib/projectStatus";
import { PO_FILTER_LABEL, type PoFilter, type PoReportRow, type poSummary } from "@/lib/projectPo";
import { useRowSelection } from "@/lib/useRowSelection";
import { ProjectBulkEditBar } from "@/components/ProjectBulkEditBar";
import { Badge } from "@/components/ui/Badge";

// 보고서 "발주서 발급 현황"(11/27 사용자 요청 "보고서에서 발주서 발급 유무 볼 수 있는 항 — 인쇄 가능") — 그 해(현장 필터를 따름) 프로젝트마다
// 발주서 발급 여부. 거르기(주소 ?po=)·요약은 서버가 lib/projectPo.ts로 만들어 넘김, 표는 머리글 정렬(기본 프로젝트 번호 최신순), 이름을 누르면
// 프로젝트 보고서. 관리자·직원은 체크해서 발주서·상태·진행률을 한 번에(ProjectBulkEditBar — 프로젝트 목록과 같은 칸). 체크칸·일괄 변경 칸은
// 인쇄에 안 나옴(인쇄는 보고서의 항목별 "인쇄" — 이 칸만).
type SortKey = "code" | "name" | "site" | "status" | "orderDate" | "quote" | "progress" | "issued";

function sortValue(r: PoReportRow, key: SortKey): string | number {
  switch (key) {
    case "code":
      return r.code ?? "";
    case "name":
      return r.name;
    case "site":
      return r.siteName;
    case "status":
      return projectStatusLabel(r.status);
    case "orderDate":
      return r.orderDate ?? "";
    case "quote":
      return r.quote;
    case "progress":
      return r.progress;
    case "issued":
      return r.issued ? 1 : 0;
  }
}

export function ProjectPoReport({
  rows,
  summary,
  filter,
  year,
  site,
  siteLabel,
  canEdit,
}: {
  /** 거른 줄(서버) */
  rows: PoReportRow[];
  /** 거르기 전 전체 요약 */
  summary: ReturnType<typeof poSummary>;
  filter: PoFilter;
  year: number;
  site?: string;
  siteLabel?: string | null;
  canEdit: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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

  const selection = useRowSelection(useMemo(() => sorted.map((r) => r.id), [sorted]));
  const reportBase = `/reports?year=${year}${site ? `&site=${site}` : ""}${filter !== "all" ? `&po=${filter}` : ""}`;

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const summaryLine = (
    <>
      {year}년{siteLabel ? ` · ${siteLabel}` : ""} 프로젝트 {summary.total}건 — 발급{" "}
      <span className="whitespace-nowrap font-semibold text-slate-900">{summary.issued.count}건</span>
      <span className="whitespace-nowrap text-slate-500">(발주액 {formatWon(summary.issued.quote)})</span> · 미발급{" "}
      <span className="whitespace-nowrap font-semibold text-red-600">{summary.notIssued.count}건</span>
      <span className="whitespace-nowrap text-slate-500">(발주액 {formatWon(summary.notIssued.quote)})</span>
      {summary.notIssuedReview > 0 && <span className="text-slate-500"> — 미발급 중 검토중 {summary.notIssuedReview}건</span>}
      {filter !== "all" && <span className="text-slate-500"> · 표: {PO_FILTER_LABEL[filter]}</span>}
    </>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">{summaryLine}</p>
      {canEdit && selection.chosen.length > 0 && (
        <ProjectBulkEditBar ids={selection.chosen} poReady onDone={selection.clear} onClear={selection.clear} />
      )}
      <div className="overflow-x-auto">
        <table className="sticky-col-table w-full min-w-[760px] text-sm print:min-w-0 print:text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {canEdit && (
                <th className="w-8 pb-2 pr-2 print:hidden">
                  <input
                    type="checkbox"
                    aria-label="보이는 프로젝트 전체 선택"
                    checked={selection.allOn}
                    onChange={selection.toggleAll}
                    className="h-4 w-4 accent-slate-900"
                  />
                </th>
              )}
              <th className="whitespace-nowrap pb-2 pr-3">{headerButton("code", "번호")}</th>
              <th className="sticky-col pb-2 pr-3">{headerButton("name", "프로젝트")}</th>
              <th className="pb-2 pr-3">{headerButton("site", "현장")}</th>
              <th className="whitespace-nowrap pb-2 pr-3">{headerButton("status", "상태")}</th>
              <th className="whitespace-nowrap pb-2 pr-3">{headerButton("orderDate", "발주서일자")}</th>
              <th className="whitespace-nowrap pb-2 pr-3 text-right">{headerButton("quote", "발주액")}</th>
              <th className="whitespace-nowrap pb-2 pr-3 text-right">{headerButton("progress", "진행률")}</th>
              <th className="whitespace-nowrap pb-2 text-center">{headerButton("issued", "발주서")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${selection.selected.has(r.id) ? "bg-brand-soft" : ""}`}>
                {canEdit && (
                  <td className="py-2 pr-2 print:hidden">
                    <input
                      type="checkbox"
                      aria-label={`${r.name} 선택`}
                      checked={selection.selected.has(r.id)}
                      onChange={() => selection.toggle(r.id)}
                      className="h-4 w-4 accent-slate-900"
                    />
                  </td>
                )}
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-500">{r.code ?? "-"}</td>
                <td
                  tabIndex={0}
                  title={r.name}
                  className="tap-full sticky-col py-2 pr-3 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:whitespace-normal print:overflow-visible"
                >
                  <Link href={`${reportBase}&project=${r.id}`} scroll={false} className="text-slate-900 hover:underline">
                    {r.name}
                  </Link>
                  {r.child && <span className="ml-1 text-xs text-slate-400">(귀속)</span>}
                </td>
                <td className="py-2 pr-3 text-slate-600 max-md:max-w-[8rem] max-md:truncate print:max-w-none print:whitespace-normal">{r.siteName}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{projectStatusLabel(r.status)}</td>
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">{r.orderDate ? formatDate(r.orderDate) : "-"}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-slate-900">{formatWon(r.quote)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-slate-600">{r.progress}%</td>
                <td className="whitespace-nowrap py-2 text-center">
                  {r.issued ? <Badge variant="emerald">발급</Badge> : <span className="text-xs font-medium text-red-600">미발급</span>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 9 : 8} className="py-6 text-center text-slate-400">
                  {filter === "all" ? "이 해의 프로젝트가 없습니다." : `${PO_FILTER_LABEL[filter]} — 해당하는 프로젝트가 없습니다.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 print:hidden">
        발주서 발급은 프로젝트 수정 화면의 &quot;발주서 발급&quot; 체크로도 바꿀 수 있습니다. 발주서일자는 프로젝트에 적은 날짜 그대로(체크와 따로).
      </p>
    </div>
  );
}
