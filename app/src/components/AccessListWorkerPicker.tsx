"use client";

import { useMemo, useState } from "react";
import { cx } from "@/lib/cx";

type OfficeOption = { id: string; name: string };
type WorkerOption = { id: string; name: string; office_id: string; grade?: string | null };
type EmployeeOption = { id: string; name: string };

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

  function toggleOffice(id: string) {
    setSelectedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredWorkers = useMemo(
    () => (selectedOffices.size === 0 ? workers : workers.filter((w) => selectedOffices.has(w.office_id))),
    [workers, selectedOffices]
  );

  return (
    <div className="space-y-3">
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
        <label className="text-xs font-medium text-slate-500">일용직 근로자 선택 (근무중)</label>
        <div className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredWorkers.map((w) => (
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
          {filteredWorkers.length === 0 && (
            <p className="text-sm text-slate-400">선택한 사무소에 근무중인 일용직이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
