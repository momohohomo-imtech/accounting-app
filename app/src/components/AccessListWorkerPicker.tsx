"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/cx";

type OfficeOption = { id: string; name: string };
type WorkerOption = { id: string; name: string; office_id: string; grade?: string | null };
type EmployeeOption = { id: string; name: string };

type SortKey = "name" | "office" | "grade";

export function AccessListWorkerPicker({
  offices,
  workers,
  employees,
}: {
  offices: OfficeOption[];
  workers: WorkerOption[];
  employees: EmployeeOption[];
}) {
  const [selectedOffices, setSelectedOffices] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleOffice(id: string) {
    setSelectedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const officeNameById = useMemo(() => new Map(offices.map((o) => [o.id, o.name])), [offices]);

  const filteredWorkers = useMemo(
    () => (selectedOffices.size === 0 ? workers : workers.filter((w) => selectedOffices.has(w.office_id))),
    [workers, selectedOffices]
  );

  const sortedWorkers = useMemo(() => {
    const copy = [...filteredWorkers];
    copy.sort((a, b) => {
      const va = sortKey === "office" ? (officeNameById.get(a.office_id) ?? "") : sortKey === "grade" ? (a.grade ?? "") : a.name;
      const vb = sortKey === "office" ? (officeNameById.get(b.office_id) ?? "") : sortKey === "grade" ? (b.grade ?? "") : b.name;
      const cmp = va.localeCompare(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredWorkers, sortKey, sortDir, officeNameById]);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500">직원 선택</label>
        <div className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-4">
          {employees.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="employee_ids" value={e.id} className="h-4 w-4" />
              {e.name}
            </label>
          ))}
          {employees.length === 0 && <p className="text-sm text-slate-400">등록된 직원이 없습니다.</p>}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">인력사무소 선택 (복수 선택 가능, 선택 안 하면 전체)</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {offices.map((o) => (
            <label
              key={o.id}
              className={cx(
                "cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                selectedOffices.has(o.id)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-100"
              )}
            >
              <input type="checkbox" checked={selectedOffices.has(o.id)} onChange={() => toggleOffice(o.id)} className="hidden" />
              {o.name}
            </label>
          ))}
          {offices.length === 0 && <p className="text-xs text-slate-400">등록된 인력사무소가 없습니다.</p>}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-medium text-slate-500">일용직 근로자 선택 (근무중)</label>
          <div className="flex items-center gap-1.5">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600"
            >
              <option value="name">이름순</option>
              <option value="office">사무소순</option>
              <option value="grade">등급순</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              {sortDir === "asc" ? "오름차순 ▲" : "내림차순 ▼"}
            </button>
          </div>
        </div>
        <div className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-4">
          {sortedWorkers.map((w) => (
            <label
              key={w.id}
              className={cx(
                "flex items-center gap-2 text-sm",
                w.grade === "불량" ? "font-medium text-red-600" : "text-slate-700"
              )}
            >
              <input type="checkbox" name="daily_worker_ids" value={w.id} className="h-4 w-4" />
              {w.name}
            </label>
          ))}
          {sortedWorkers.length === 0 && (
            <p className="text-sm text-slate-400">선택한 사무소에 근무중인 일용직이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
