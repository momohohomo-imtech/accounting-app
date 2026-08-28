"use client";

import { useMemo, useState } from "react";
import type {
  BusinessTripEquipment,
  BusinessTripExpense,
  BusinessTripLog,
  BusinessTripProject,
  BusinessTripWorker,
} from "@/lib/types";
import { WORK_TYPE_OPTIONS } from "@/lib/businessTrip";
import { getWorkLogsForDate, type WorkLogDateEntry } from "@/lib/actions/worklogs";
import { fieldClass, labelClass } from "@/components/ui/field";
import { Button } from "@/components/ui/Button";

function emptyWorker(): BusinessTripWorker {
  return { name: "", overtime: false, note: "" };
}
function emptyEquipment(): BusinessTripEquipment {
  return { name: "", location: "", hours: "", note: "" };
}
function emptyExpense(): BusinessTripExpense {
  return { vendor: "", amount: "", note: "" };
}
function emptyProject(workDate: string): BusinessTripProject {
  return {
    work_date: workDate,
    project_name: "",
    workers: [emptyWorker(), emptyWorker(), emptyWorker()],
    personnel_note: "",
    total_manpower: "",
    equipment: [emptyEquipment()],
    expenses: [emptyExpense()],
  };
}

function ProjectBlockEditor({
  project,
  index,
  onChange,
  onRemove,
  canRemove,
  onSiteNameFill,
}: {
  project: BusinessTripProject;
  index: number;
  onChange: (p: BusinessTripProject) => void;
  onRemove: () => void;
  canRemove: boolean;
  onSiteNameFill: (name: string) => void;
}) {
  const [manpowerTouched, setManpowerTouched] = useState(Boolean(project.total_manpower));
  const autoManpower = useMemo(() => project.workers.filter((w) => w.name.trim()).length, [project.workers]);
  const manpowerDisplay = manpowerTouched ? project.total_manpower : String(autoManpower);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [dateEntries, setDateEntries] = useState<WorkLogDateEntry[] | null>(null);

  async function togglePicker() {
    const next = !pickerOpen;
    setPickerOpen(next);
    if (next) {
      setLoadingEntries(true);
      const entries = await getWorkLogsForDate(project.work_date);
      setDateEntries(entries);
      setLoadingEntries(false);
    }
  }

  function pickEntry(entry: WorkLogDateEntry) {
    onChange({ ...project, project_name: entry.title });
    if (entry.site_name) onSiteNameFill(entry.site_name);
    setPickerOpen(false);
  }

  function updateWorker(i: number, patch: Partial<BusinessTripWorker>) {
    onChange({ ...project, workers: project.workers.map((w, idx) => (idx === i ? { ...w, ...patch } : w)) });
  }
  function updateEquipment(i: number, patch: Partial<BusinessTripEquipment>) {
    onChange({ ...project, equipment: project.equipment.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  }
  function updateExpense(i: number, patch: Partial<BusinessTripExpense>) {
    onChange({ ...project, expenses: project.expenses.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-slate-400">프로젝트 #{index + 1}</span>
          <input
            type="date"
            value={project.work_date}
            onChange={(e) => onChange({ ...project, work_date: e.target.value })}
            className={`${fieldClass} w-40 shrink-0`}
          />
          <input
            value={project.project_name}
            onChange={(e) => onChange({ ...project, project_name: e.target.value })}
            placeholder="프로젝트명 (직접 입력 또는 달력에서 선택)"
            className={`${fieldClass} flex-1`}
          />
          <button
            type="button"
            onClick={togglePicker}
            className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-600 hover:bg-slate-100"
          >
            달력에서 선택
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <p className="mb-1 px-1 text-xs text-slate-400">{project.work_date} 작업일지 내역</p>
              {loadingEntries ? (
                <p className="px-1 py-2 text-xs text-slate-400">불러오는 중...</p>
              ) : dateEntries && dateEntries.length > 0 ? (
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  {dateEntries.map((entry, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickEntry(entry)}
                      className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                    >
                      <span className="font-medium text-slate-900">{entry.site_name ?? "현장 없음"}</span>
                      <span className="ml-1 text-slate-500">{entry.title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-2 text-xs text-slate-400">이 날짜에 작업일지 내역이 없습니다.</p>
              )}
            </div>
          )}
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="shrink-0 text-xs text-red-500 hover:text-red-700">
            프로젝트 삭제
          </button>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">작업 인원 내역</h3>
          <button
            type="button"
            onClick={() => onChange({ ...project, workers: [...project.workers, emptyWorker()] })}
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 인원 추가
          </button>
        </div>
        <p className="mb-1.5 text-xs text-slate-400">근무일은 이 프로젝트의 공사일과 동일하게 적용됩니다.</p>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_5rem_1fr_3rem] gap-2 px-1 text-xs font-medium text-slate-500">
            <span>작업자명</span>
            <span>추가근무</span>
            <span>비고</span>
            <span />
          </div>
          {project.workers.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_1fr_3rem] items-center gap-2">
              <input value={w.name} onChange={(e) => updateWorker(i, { name: e.target.value })} className={fieldClass} />
              <input
                type="checkbox"
                checked={w.overtime}
                onChange={(e) => updateWorker(i, { overtime: e.target.checked })}
                className="h-4 w-4 justify-self-center"
              />
              <input value={w.note} onChange={(e) => updateWorker(i, { note: e.target.value })} className={fieldClass} />
              {project.workers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...project, workers: project.workers.filter((_, idx) => idx !== i) })}
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
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 text-sm text-slate-500">비고</span>
          <input
            value={project.personnel_note}
            onChange={(e) => onChange({ ...project, personnel_note: e.target.value })}
            className={`${fieldClass} flex-1`}
          />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <span className="text-sm text-slate-500">총 공수</span>
          <input
            value={manpowerDisplay}
            onChange={(e) => {
              setManpowerTouched(true);
              onChange({ ...project, total_manpower: e.target.value });
            }}
            className={`${fieldClass} w-20 text-right`}
          />
          <span className="text-sm text-slate-500">명</span>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">장비 사용 내역</h3>
          <button
            type="button"
            onClick={() => onChange({ ...project, equipment: [...project.equipment, emptyEquipment()] })}
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
          {project.equipment.map((eq, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_6rem_1fr_3rem] items-center gap-2">
              <input value={eq.name} onChange={(e) => updateEquipment(i, { name: e.target.value })} className={fieldClass} />
              <input
                value={eq.location}
                onChange={(e) => updateEquipment(i, { location: e.target.value })}
                className={fieldClass}
              />
              <input value={eq.hours} onChange={(e) => updateEquipment(i, { hours: e.target.value })} className={fieldClass} />
              <input value={eq.note} onChange={(e) => updateEquipment(i, { note: e.target.value })} className={fieldClass} />
              {project.equipment.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...project, equipment: project.equipment.filter((_, idx) => idx !== i) })}
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
          <h3 className="text-sm font-semibold text-slate-900">현장 지출 내역</h3>
          <button
            type="button"
            onClick={() => onChange({ ...project, expenses: [...project.expenses, emptyExpense()] })}
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
          {project.expenses.map((ex, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_1fr_3rem] items-center gap-2">
              <input value={ex.vendor} onChange={(e) => updateExpense(i, { vendor: e.target.value })} className={fieldClass} />
              <input value={ex.amount} onChange={(e) => updateExpense(i, { amount: e.target.value })} className={fieldClass} />
              <input value={ex.note} onChange={(e) => updateExpense(i, { note: e.target.value })} className={fieldClass} />
              {project.expenses.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...project, expenses: project.expenses.filter((_, idx) => idx !== i) })}
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
    </div>
  );
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
  const [createdDate, setCreatedDate] = useState(initial?.created_date ?? today);
  const [workTypes, setWorkTypes] = useState<Set<string>>(new Set(initial?.work_types ?? []));
  const [note, setNote] = useState(initial?.note ?? "");
  const [projects, setProjects] = useState<BusinessTripProject[]>(
    initial?.projects?.length
      ? initial.projects.map((p) => ({ ...p, work_date: p.work_date ?? workDate, personnel_note: p.personnel_note ?? "" }))
      : [emptyProject(workDate)]
  );
  const [saving, setSaving] = useState(false);

  function toggleWorkType(t: string) {
    setWorkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function updateProject(i: number, p: BusinessTripProject) {
    setProjects((prev) => prev.map((existing, idx) => (idx === i ? p : existing)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (initial) fd.append("id", initial.id);
    fd.append("client_name", clientName);
    fd.append("site_name", siteName);
    fd.append("created_date", createdDate);
    workTypes.forEach((t) => fd.append("work_types", t));
    fd.append("note", note);
    const cleanedProjects = projects.map((p) => ({
      ...p,
      workers: p.workers.filter((w) => w.name.trim() || w.note.trim()),
      equipment: p.equipment.filter((e) => e.name.trim() || e.location.trim() || e.note.trim()),
      expenses: p.expenses.filter((e) => e.vendor.trim() || e.amount.trim() || e.note.trim()),
    }));
    fd.append("projects_json", JSON.stringify(cleanedProjects));
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
          <label className={labelClass}>작성일</label>
          <input type="date" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">프로젝트별 내역 (하루에 여러 프로젝트 가능)</h2>
          <button
            type="button"
            onClick={() =>
              setProjects((prev) => [...prev, emptyProject(prev[prev.length - 1]?.work_date ?? today)])
            }
            className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            + 프로젝트 추가
          </button>
        </div>
        {projects.map((p, i) => (
          <ProjectBlockEditor
            key={i}
            project={p}
            index={i}
            onChange={(updated) => updateProject(i, updated)}
            onRemove={() => setProjects((prev) => prev.filter((_, idx) => idx !== i))}
            canRemove={projects.length > 1}
            onSiteNameFill={setSiteName}
          />
        ))}
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
