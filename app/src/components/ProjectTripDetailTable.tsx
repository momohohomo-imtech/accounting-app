"use client";

import { useMemo, useState } from "react";
import { countLabel, tripTotals, type TripDayRow } from "@/lib/tripLog";

export type ProjectTripDetailRow = TripDayRow & { contents: string; projectLabel: string };

type SortKey = "date" | "project" | "contents" | "staff" | "helper" | "total" | "equipment";

function sortValue(r: ProjectTripDetailRow, key: SortKey): string | number {
  switch (key) {
    case "date":
      return r.work_date;
    case "project":
      return r.projectLabel;
    case "contents":
      return r.contents;
    case "staff":
      return r.staff_count;
    case "helper":
      return r.helper_count;
    case "total":
      return r.staff_count + r.helper_count;
    case "equipment":
      return r.equipment_used ? 1 : 0;
  }
}

// 프로젝트 보고서(손익 보고서 팝업)의 "출장 내역" — 출장 업무 내역서와 같은 날짜 줄을 손익 보고서 안에서 봄(사용자 요청
// "보고서에서 출장일지를 한눈에"). 귀속 하위 프로젝트까지 묶은 보고서면 프로젝트 칸을 같이 보여줌. 0·없는 값은 공란.
export function ProjectTripDetailTable({ rows, showProject }: { rows: ProjectTripDetailRow[]; showProject: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const totals = useMemo(() => tripTotals(rows), [rows]);
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px] print:hidden">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const textCell = "py-1 pr-3 print:py-0.5";
  const numCell = "py-1 pr-3 text-right tabular-nums print:py-0.5";

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="sticky-col-table w-full min-w-[640px] text-sm print:min-w-0 print:text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="pb-1 pr-3">{headerButton("date", "날짜")}</th>
            {showProject && <th className="pb-1 pr-3">{headerButton("project", "프로젝트")}</th>}
            <th className="sticky-col pb-1 pr-3">{headerButton("contents", "작업 내용")}</th>
            <th className="pb-1 pr-3 text-right">{headerButton("staff", "사내")}</th>
            <th className="pb-1 pr-3 text-right">{headerButton("helper", "조공")}</th>
            <th className="pb-1 pr-3 text-right">{headerButton("total", "계")}</th>
            <th className="pb-1 pr-3 text-center">{headerButton("equipment", "장비")}</th>
            <th className="pb-1 pr-3">사용처·시간</th>
            <th className="pb-1">비고</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className={`${textCell} whitespace-nowrap tabular-nums text-slate-700`}>{r.work_date}</td>
              {showProject && (
                <td
                  className={`${textCell} text-slate-700 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal`}
                  title={r.projectLabel}
                >
                  {r.projectLabel}
                </td>
              )}
              <td
                className={`sticky-col ${textCell} text-slate-900 max-md:max-w-[10rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal`}
                title={r.contents}
              >
                {r.contents}
              </td>
              <td className={`${numCell} text-slate-700`}>{countLabel(r.staff_count)}</td>
              <td className={`${numCell} text-slate-700`}>{countLabel(r.helper_count)}</td>
              <td className={`${numCell} font-semibold text-slate-900`}>{countLabel(r.staff_count + r.helper_count)}</td>
              <td className={`${textCell} text-center text-slate-700`}>{r.equipment_used ? "O" : ""}</td>
              <td className={`${textCell} text-slate-700`}>
                {[r.equipment_place, r.equipment_hours].filter(Boolean).join(" · ")}
              </td>
              <td className="py-1 text-slate-700 print:py-0.5">{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
            <td className={textCell}>합계</td>
            {showProject && <td />}
            <td className={`sticky-col ${textCell} tabular-nums`}>{countLabel(totals.days, "일")}</td>
            <td className={numCell}>{countLabel(totals.staff)}</td>
            <td className={numCell}>{countLabel(totals.helper)}</td>
            <td className={numCell}>{countLabel(totals.people)}</td>
            <td className={`${textCell} text-center tabular-nums`}>{countLabel(totals.equipmentDays, "일")}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
