"use client";

import { useMemo, useState } from "react";
import type { BusinessTripEquipment, BusinessTripExpense, BusinessTripLog, BusinessTripWorker } from "@/lib/types";
import { WORK_TYPE_OPTIONS } from "@/lib/businessTrip";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

function emptyWorker(workDate: string): BusinessTripWorker {
  return { name: "", work_date: workDate, overtime: false, note: "" };
}
function emptyEquipment(): BusinessTripEquipment {
  return { name: "", location: "", hours: "", note: "" };
}
function emptyExpense(): BusinessTripExpense {
  return { vendor: "", amount: "", note: "" };
}

export function BusinessTripLogForm({
  initial,
  defaultWorkDate,
  action,
  onSaved,
  onCancel,
}: {
  initial?: BusinessTripLog;
  defaultWorkDate?: string;
  action: (formData: FormData) => Promise<void> | void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const workDate = initial?.work_date ?? defaultWorkDate ?? today;

  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [siteName, setSiteName] = useState(initial?.site_name ?? "");
  const [projectName, setProjectName] = useState(initial?.project_name ?? "");
  const [workDateValue, setWorkDateValue] = useState(workDate);
  const [createdDate, setCreatedDate] = useState(initial?.created_date ?? today);
  const [workTypes, setWorkTypes] = useState<Set<string>>(new Set(initial?.work_types ?? []));
  const [note, setNote] = useState(initial?.note ?? "");

  const [workers, setWorkers] = useState<BusinessTripWorker[]>(
    initial?.workers?.length ? initial.workers : [emptyWorker(workDate), emptyWorker(workDate), emptyWorker(workDate)]
  );
  const [manpowerTouched, setManpowerTouched] = useState(Boolean(initial?.total_manpower));
  const [totalManpower, setTotalManpower] = useState(initial?.total_manpower ?? "");

  const [equipment, setEquipment] = useState<BusinessTripEquipment[]>(
    initial?.equipment?.length ? initial.equipment : [emptyEquipment()]
  );
  const [expenses, setExpenses] = useState<BusinessTripExpense[]>(
    initial?.expenses?.length ? initial.expenses : [emptyExpense()]
  );
  const [saving, setSaving] = useState(false);

  const autoManpower = useMemo(() => workers.filter((w) => w.name.trim()).length, [workers]);
  const manpowerDisplay = manpowerTouched ? totalManpower : String(autoManpower);

  function toggleWorkType(t: string) {
    setWorkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function updateWorker(i: number, patch: Partial<BusinessTripWorker>) {
    setWorkers((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function updateEquipment(i: number, patch: Partial<BusinessTripEquipment>) {
    setEquipment((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function updateExpense(i: number, patch: Partial<BusinessTripExpense>) {
    setExpenses((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (initial) fd.append("id", initial.id);
    fd.append("client_name", clientName);
    fd.append("site_name", siteName);
    fd.append("project_name", projectName);
    fd.append("work_date", workDateValue);
    fd.append("created_date", createdDate);
    workTypes.forEach((t) => fd.append("work_types", t));
    fd.append("note", note);
    fd.append("workers_json", JSON.stringify(workers.filter((w) => w.name.trim() || w.note.trim())));
    fd.append("total_manpower", manpowerDisplay);
    fd.append("equipment_json", JSON.stringify(equipment.filter((e) => e.name.trim() || e.location.trim() || e.note.trim())));
    fd.append("expenses_json", JSON.stringify(expenses.filter((e) => e.vendor.trim() || e.amount.trim() || e.note.trim())));
    await action(fd);
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>원청사</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>현장명</label>
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>프로젝트명</label>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>공사일</label>
          <input type="date" value={workDateValue} onChange={(e) => setWorkDateValue(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>작성일</label>
          <input type="date" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>작업구분</label>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {WORK_TYPE_OPTIONS.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" checked={workTypes.has(t)} onChange={() => toggleWorkType(t)} className="h-4 w-4" />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-3">
          <label className={labelClass}>비고</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">작업 인원 내역</h3>
          <button
            type="button"
            onClick={() => setWorkers((prev) => [...prev, emptyWorker(workDateValue)])}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 인원 추가
          </button>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_8rem_5rem_1fr_3rem] gap-2 px-1 text-xs font-medium text-slate-500">
            <span>작업자명</span>
            <span>근무일</span>
            <span>추가근무</span>
            <span>비고</span>
            <span />
          </div>
          {workers.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_5rem_1fr_3rem] items-center gap-2">
              <input value={w.name} onChange={(e) => updateWorker(i, { name: e.target.value })} className={fieldClass} />
              <input
                type="date"
                value={w.work_date}
                onChange={(e) => updateWorker(i, { work_date: e.target.value })}
                className={fieldClass}
              />
              <input
                type="checkbox"
                checked={w.overtime}
                onChange={(e) => updateWorker(i, { overtime: e.target.checked })}
                className="h-4 w-4 justify-self-center"
              />
              <input value={w.note} onChange={(e) => updateWorker(i, { note: e.target.value })} className={fieldClass} />
              {workers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setWorkers((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <span className="text-sm text-slate-500">총 공수</span>
          <input
            value={manpowerDisplay}
            onChange={(e) => {
              setManpowerTouched(true);
              setTotalManpower(e.target.value);
            }}
            className={`${fieldClass} w-20 text-right`}
          />
          <span className="text-sm text-slate-500">명</span>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">장비 사용 내역</h3>
          <button
            type="button"
            onClick={() => setEquipment((prev) => [...prev, emptyEquipment()])}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 장비 추가
          </button>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_1fr_6rem_1fr_3rem] gap-2 px-1 text-xs font-medium text-slate-500">
            <span>장비명</span>
            <span>사용처</span>
            <span>작업시간</span>
            <span>비고</span>
            <span />
          </div>
          {equipment.map((eq, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_6rem_1fr_3rem] items-center gap-2">
              <input value={eq.name} onChange={(e) => updateEquipment(i, { name: e.target.value })} className={fieldClass} />
              <input value={eq.location} onChange={(e) => updateEquipment(i, { location: e.target.value })} className={fieldClass} />
              <input value={eq.hours} onChange={(e) => updateEquipment(i, { hours: e.target.value })} className={fieldClass} />
              <input value={eq.note} onChange={(e) => updateEquipment(i, { note: e.target.value })} className={fieldClass} />
              {equipment.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setEquipment((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">현장 지출 내역</h3>
          <button
            type="button"
            onClick={() => setExpenses((prev) => [...prev, emptyExpense()])}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 지출 추가
          </button>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_8rem_1fr_3rem] gap-2 px-1 text-xs font-medium text-slate-500">
            <span>사용처</span>
            <span>금액</span>
            <span>비고</span>
            <span />
          </div>
          {expenses.map((ex, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_1fr_3rem] items-center gap-2">
              <input value={ex.vendor} onChange={(e) => updateExpense(i, { vendor: e.target.value })} className={fieldClass} />
              <input value={ex.amount} onChange={(e) => updateExpense(i, { amount: e.target.value })} className={fieldClass} />
              <input value={ex.note} onChange={(e) => updateExpense(i, { note: e.target.value })} className={fieldClass} />
              {expenses.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setExpenses((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          취소
        </Button>
      </div>
    </form>
  );
}
