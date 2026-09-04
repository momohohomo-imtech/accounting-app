"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { AccessListExportButton } from "@/components/AccessListExportButton";
import { AccessListPrintPopup } from "@/components/AccessListPrintPopup";
import { AccessApplicationPopup } from "@/components/AccessApplicationPopup";
import { AccessListWorkerPicker } from "@/components/AccessListWorkerPicker";
import { Button } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

type Member = {
  id: string;
  name: string;
  phone: string | null;
  nationality: string | null;
  birthDate: string | null;
  grade?: string | null;
  note: string;
  dailyWorkerId?: string | null;
  employeeId?: string | null;
};

type SiteOption = { id: string; name: string };
type OfficeOption = { id: string; name: string };
type WorkerOption = { id: string; name: string; office_id: string; grade?: string | null };
type EmployeeOption = { id: string; name: string };
type ManualEntry = { key: string; name: string; phone: string; birthDate: string; nationality: string };

export function AccessListCard({
  id,
  companyName,
  siteId,
  siteName,
  supervisorName,
  accessPeriod,
  createdAt,
  members,
  siteOptions,
  offices,
  workers,
  employees,
  updateAction,
  deleteAction,
}: {
  id: string;
  companyName: string;
  siteId: string | null;
  siteName: string | null;
  supervisorName: string | null;
  accessPeriod: string | null;
  createdAt: string;
  members: Member[];
  siteOptions: SiteOption[];
  offices: OfficeOption[];
  workers: WorkerOption[];
  employees: EmployeeOption[];
  updateAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
  deleteAction: (formData: FormData) => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const globalPending = useGlobalPending();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftCompanyName, setDraftCompanyName] = useState(companyName);
  const [draftSiteId, setDraftSiteId] = useState(siteId ?? "");
  const [draftSupervisorName, setDraftSupervisorName] = useState(supervisorName ?? "");
  const [draftAccessPeriod, setDraftAccessPeriod] = useState(accessPeriod ?? "");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.id, m.note]))
  );
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [manualDraft, setManualDraft] = useState({ name: "", phone: "", birthDate: "", nationality: "" });
  const pickerFormRef = useRef<HTMLFormElement>(null);

  function startEditing() {
    setDraftCompanyName(companyName);
    setDraftSiteId(siteId ?? "");
    setDraftSupervisorName(supervisorName ?? "");
    setDraftAccessPeriod(accessPeriod ?? "");
    setDraftNotes(Object.fromEntries(members.map((m) => [m.id, m.note])));
    setManualEntries([]);
    setManualDraft({ name: "", phone: "", birthDate: "", nationality: "" });
    setError(null);
    setEditing(true);
  }

  function addManualEntry() {
    if (!manualDraft.name.trim()) return;
    setManualEntries((prev) => [...prev, { key: crypto.randomUUID(), ...manualDraft }]);
    setManualDraft({ name: "", phone: "", birthDate: "", nationality: "" });
  }
  function removeManualEntry(key: string) {
    setManualEntries((prev) => prev.filter((m) => m.key !== key));
  }

  async function handleSave() {
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.append("id", id);
    fd.append("company_name", draftCompanyName);
    fd.append("site_id", draftSiteId);
    fd.append("supervisor_name", draftSupervisorName);
    fd.append("access_period", draftAccessPeriod);
    members.forEach((m) => {
      fd.append("worker_id", m.id);
      fd.append("worker_note", draftNotes[m.id] ?? "");
    });
    if (pickerFormRef.current) {
      const pickerFd = new FormData(pickerFormRef.current);
      for (const v of pickerFd.getAll("daily_worker_ids")) fd.append("new_daily_worker_ids", v);
      for (const v of pickerFd.getAll("employee_ids")) fd.append("new_employee_ids", v);
    }
    for (const m of manualEntries) {
      fd.append("new_manual_name", m.name);
      fd.append("new_manual_phone", m.phone);
      fd.append("new_manual_birth_date", m.birthDate);
      fd.append("new_manual_nationality", m.nationality);
    }
    const result = await globalPending.run(() => updateAction(fd));
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>원청 회사명</label>
            <input
              value={draftCompanyName}
              onChange={(e) => setDraftCompanyName(e.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>현장</label>
            <select value={draftSiteId} onChange={(e) => setDraftSiteId(e.target.value)} className={fieldClass}>
              <option value="">선택 안함</option>
              {siteOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>감독관</label>
            <input
              value={draftSupervisorName}
              onChange={(e) => setDraftSupervisorName(e.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>출입 기간</label>
            <input
              value={draftAccessPeriod}
              onChange={(e) => setDraftAccessPeriod(e.target.value)}
              placeholder="예: 2026-08-23~24"
              autoComplete="off"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <p className={labelClass}>인원별 비고</p>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate text-slate-700">{m.name}</span>
              <input
                value={draftNotes[m.id] ?? ""}
                onChange={(e) => setDraftNotes((prev) => ({ ...prev, [m.id]: e.target.value }))}
                placeholder="비고"
                autoComplete="off"
                className={`${fieldClass} flex-1`}
              />
            </div>
          ))}
          {members.length === 0 && <p className="text-sm text-slate-400">등록된 인원이 없습니다.</p>}
        </div>

        <div className="mt-4 space-y-2">
          <p className={labelClass}>인원 추가 — 인력사무소/직원 DB에서 선택</p>
          <form ref={pickerFormRef} onSubmit={(e) => e.preventDefault()}>
            <AccessListWorkerPicker
              offices={offices}
              workers={workers.filter((w) => !members.some((m) => m.dailyWorkerId === w.id))}
              employees={employees.filter((e) => !members.some((m) => m.employeeId === e.id))}
            />
          </form>
        </div>

        <div className="mt-4 space-y-2">
          <p className={labelClass}>인원 추가 — 임의(수동 기입)</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">이름</label>
              <input
                value={manualDraft.name}
                onChange={(e) => setManualDraft((prev) => ({ ...prev, name: e.target.value }))}
                autoComplete="off"
                className={`${fieldClass} w-32`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">연락처</label>
              <input
                value={manualDraft.phone}
                onChange={(e) => setManualDraft((prev) => ({ ...prev, phone: e.target.value }))}
                autoComplete="off"
                className={`${fieldClass} w-32`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">생년월일</label>
              <input
                value={manualDraft.birthDate}
                onChange={(e) => setManualDraft((prev) => ({ ...prev, birthDate: e.target.value }))}
                placeholder="YYYY-MM-DD"
                autoComplete="off"
                className={`${fieldClass} w-32`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">국적</label>
              <input
                value={manualDraft.nationality}
                onChange={(e) => setManualDraft((prev) => ({ ...prev, nationality: e.target.value }))}
                autoComplete="off"
                className={`${fieldClass} w-24`}
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addManualEntry}>
              + 추가
            </Button>
          </div>
          {manualEntries.length > 0 && (
            <ul className="space-y-1">
              {manualEntries.map((m) => (
                <li key={m.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="flex-1">
                    {m.name}
                    {m.phone && ` · ${m.phone}`}
                    {m.birthDate && ` · ${m.birthDate}`}
                    {m.nationality && ` · ${m.nationality}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeManualEntry(m.key)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-2">
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            저장
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{companyName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {siteName ?? "현장 미지정"} · {supervisorName ?? "감독관 미지정"} · {accessPeriod ?? "기간 미지정"} · 생성일{" "}
            {formatDate(createdAt)}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            인원 {members.length}명:{" "}
            {members.length === 0
              ? "-"
              : members.map((m, i) => (
                  <span key={m.id}>
                    <span className={m.grade === "불량" ? "font-medium text-red-600" : undefined}>
                      {m.name}
                      {m.birthDate && <span className="text-slate-400">({formatDate(m.birthDate)})</span>}
                    </span>
                    {i < members.length - 1 && ", "}
                  </span>
                ))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="xs" onClick={startEditing}>
            수정
          </Button>
          <Button variant="secondary" size="xs" onClick={() => setPrinting(true)}>
            인쇄
          </Button>
          <Button variant="secondary" size="xs" onClick={() => setApplying(true)}>
            출입신청서
          </Button>
          <AccessListExportButton
            companyName={companyName}
            accessPeriod={accessPeriod ?? ""}
            supervisorName={supervisorName ?? ""}
            members={members}
          />
          {confirming ? (
            <form action={deleteAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={id} />
              <span className="text-xs font-medium text-red-600">정말 삭제?</span>
              <button
                type="submit"
                className="rounded-lg border border-red-300 bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700"
              >
                확인
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {printing && (
        <AccessListPrintPopup
          companyName={companyName}
          siteName={siteName}
          supervisorName={supervisorName}
          accessPeriod={accessPeriod}
          members={members}
          onClose={() => setPrinting(false)}
        />
      )}

      {applying && (
        <AccessApplicationPopup
          supervisorName={supervisorName}
          members={members}
          onClose={() => setApplying(false)}
        />
      )}
    </div>
  );
}
