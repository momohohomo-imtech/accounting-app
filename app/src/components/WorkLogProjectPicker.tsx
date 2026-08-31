"use client";

import { useMemo, useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/field";
import type { WorkLogProjectOption } from "@/components/WorkLogRowInput";

function projectNumber(code: string | null) {
  const m = code?.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function WorkLogProjectPicker({
  projects,
  value,
  onChange,
  defaultYear,
}: {
  /** 이미 그 줄의 현장으로 필터된 프로젝트 목록 — 현장 선택은 그대로 줄 자체에서 처리. */
  projects: WorkLogProjectOption[];
  value: string;
  onChange: (id: string) => void;
  defaultYear: number;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultYear);

  const years = useMemo(() => Array.from(new Set(projects.map((p) => p.year))).sort((a, b) => b - a), [projects]);

  const selected = projects.find((p) => p.id === value);

  // 진행중 프로젝트만, 번호(프로젝트코드 뒤 순번) 큰 것이 위로.
  const listForYear = useMemo(
    () =>
      [...projects]
        .filter((p) => p.year === year && p.status === "ongoing")
        .sort((a, b) => projectNumber(b.project_code) - projectNumber(a.project_code)),
    [projects, year]
  );

  function openPicker() {
    setYear(years.includes(defaultYear) ? defaultYear : (years[0] ?? defaultYear));
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openPicker} className={`${fieldClass} truncate text-left`}>
        {selected ? `${selected.name}${selected.project_code ? ` (${selected.project_code})` : ""}` : "프로젝트 없음"}
      </button>

      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => setOpen(false)}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 font-semibold text-slate-900">프로젝트 선택</h3>
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs text-slate-500">연도</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={fieldClass}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${!value ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  프로젝트 없음
                </button>
                {listForYear.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${value === p.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    {p.name}
                    {p.project_code ? ` (${p.project_code})` : ""}
                  </button>
                ))}
                {listForYear.length === 0 && (
                  <p className="px-3 py-2 text-sm text-slate-400">해당 연도에 진행중인 프로젝트가 없습니다.</p>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  닫기
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
