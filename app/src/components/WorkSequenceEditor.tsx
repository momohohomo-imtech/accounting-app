"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { Button } from "@/components/ui/Button";
import { fieldClass, inlineFieldClass, labelClass } from "@/components/ui/field";
import { SeqInput } from "@/components/ui/SeqInput";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { WorkSequenceChart } from "@/components/WorkSequenceChart";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { closePopup } from "@/lib/popupNavigation";
import { moveListItem } from "@/lib/listMove";
import { todayString } from "@/lib/format";
import { cx } from "@/lib/cx";
import { memoFileName } from "@/lib/memoExport";
import { downloadWorkSequenceXlsx } from "@/lib/xlsxExport";
import { saveWorkSequence } from "@/lib/actions/workSequences";
import {
  chartColumns,
  doneCount,
  formatAmount,
  normalizeAmount,
  scheduleSteps,
  sequenceRangeLabel,
  stepRangeLabel,
  totalSpan,
  UNIT_LABEL,
  type SequenceUnit,
} from "@/lib/workSequence";

export type WorkSequenceStepData = {
  id: string;
  content: string;
  detail: string;
  duration: number;
  overlap: number;
  done: boolean;
  done_date: string | null;
};

export type WorkSequenceData = {
  id: string;
  project_id: string;
  title: string;
  unit: SequenceUnit;
  start_date: string | null;
  start_time: string | null;
  steps: WorkSequenceStepData[];
};

// 화면에서 미리 만드는 id — 저장 도중 실패해 다시 눌러도 같은 순서표·단계로 저장되게(lib/actions/workSequences.ts).
function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const emptyStep = (): WorkSequenceStepData => ({
  id: newId(),
  content: "",
  detail: "",
  duration: 1,
  overlap: 0,
  done: false,
  done_date: null,
});

// 공사 작업 순서표 팝업(주소 ?tab=sequence&seq=…, 사용자 요청 11/2) — 프로젝트·제목·단위(일/시간)·시작, 단계 표(순번을 고치면 그 줄이
// 내용째 그 자리로 옮겨감 · 작업 내용 · 세부 설명·주의사항 · 기간 · 앞 작업과 겹침 · 일정(자동) · 완료·완료일), 흐름 차트(겹침 −/+).
// "저장"을 눌러야 저장됨 — 저장 안 하고 닫으면 물어봄. 인쇄는 이 팝업만(가로 A4), 엑셀은 지금 화면 내용 그대로.
export function WorkSequenceEditor({
  initial,
  isNew,
  sites,
  projects,
  projectLabels,
  closeHref,
  savedHref,
}: {
  initial: WorkSequenceData;
  isNew: boolean;
  sites: SiteOption[];
  projects: ProjectOption[];
  /** 프로젝트 id → "현장 · 프로젝트"(엑셀·인쇄 머리) */
  projectLabels: Record<string, string>;
  closeHref: string;
  /** 새 순서표를 저장한 뒤 주소(…&seq=) — 다시 저장하면 같은 순서표를 고치게 */
  savedHref: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [data, setData] = useState<WorkSequenceData>(() => (isNew ? { ...initial, id: newId() } : initial));
  const [savedJson, setSavedJson] = useState(() => (isNew ? "" : JSON.stringify(initial)));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirty = JSON.stringify(data) !== savedJson;

  const seqStart = { unit: data.unit, start_date: data.start_date, start_time: data.start_time };
  const schedule = useMemo(() => scheduleSteps(data.steps), [data.steps]);
  const unitLabel = UNIT_LABEL[data.unit];
  const amountStep = data.unit === "day" ? 1 : 0.5;

  function update(patch: Partial<WorkSequenceData>) {
    setData((d) => ({ ...d, ...patch }));
  }
  function updateStep(index: number, patch: Partial<WorkSequenceStepData>) {
    setData((d) => ({ ...d, steps: d.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }
  function changeUnit(unit: SequenceUnit) {
    // 단위를 바꾸면 숫자는 그대로 두고 그 단위 규칙(일은 정수)으로만 맞춤
    setData((d) => ({
      ...d,
      unit,
      steps: d.steps.map((s) => ({
        ...s,
        duration: normalizeAmount(s.duration, unit, "duration"),
        overlap: normalizeAmount(s.overlap, unit, "overlap"),
      })),
    }));
  }
  function setOverlap(index: number, value: number) {
    updateStep(index, { overlap: normalizeAmount(value, data.unit, "overlap") });
  }
  async function removeStep(index: number) {
    const step = data.steps[index];
    if ((step.content.trim() || step.detail.trim()) && !(await confirm(`${index + 1}번 단계를 지울까요? (저장해야 반영됩니다)`))) return;
    setData((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }));
  }

  async function save() {
    setError(null);
    const result = await pending.run(() => saveWorkSequence(data));
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSavedJson(JSON.stringify(data));
    setSavedAt(new Date().toTimeString().slice(0, 5));
    // 새 순서표는 주소를 저장된 순서표로 바꿈(기록은 안 쌓음) — 다시 저장하면 같은 순서표를 고치게
    if (isNew) router.replace(`${savedHref}${data.id}`, { scroll: false });
  }

  async function close() {
    if (dirty && !(await confirm("저장하지 않은 내용이 있습니다. 저장하지 않고 닫을까요?"))) return;
    closePopup(router, closeHref);
  }
  useEscapeKey(true, close);

  const projectLabel = projectLabels[data.project_id] ?? "-";
  const startLabel = data.start_date
    ? `${data.start_date}${data.unit === "hour" && data.start_time ? ` ${data.start_time}` : ""}`
    : "-";
  const doneLabel = `${doneCount(data.steps)}/${data.steps.length}단계 완료`;
  const rangeLabel = sequenceRangeLabel(schedule, seqStart);

  function downloadExcel() {
    downloadWorkSequenceXlsx(memoFileName(["공사작업순서", projectLabel.split(" · ").pop(), data.title]), {
      title: data.title || "공사 작업 순서",
      projectLabel,
      unit: data.unit,
      startLabel,
      rangeLabel: `${rangeLabel} (${formatAmount(totalSpan(schedule), data.unit)})`,
      doneLabel,
      steps: data.steps.map((s, i) => ({ ...s, range: stepRangeLabel(schedule[i], seqStart) })),
      schedule,
      columns: chartColumns(totalSpan(schedule), seqStart),
    });
  }

  return (
    <ModalPortal>
      {/* 흐름 차트가 넓어서 인쇄는 가로 A4 — 이 팝업이 열려 있을 때만 */}
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/50 p-4 py-10 max-md:px-2 print:static print:block print:overflow-visible print:bg-transparent print:p-0">
        <div className="w-full max-w-6xl space-y-5 rounded-2xl bg-white p-6 shadow-xl max-md:p-3 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {isNew && !savedJson ? "공사 작업 순서표 작성" : "공사 작업 순서표"}
              {savedAt && !dirty && <span className="ml-2 text-xs font-normal text-emerald-600 print:hidden">{savedAt} 저장됨</span>}
              {dirty && savedJson && <span className="ml-2 text-xs font-normal text-amber-600 print:hidden">저장 안 한 변경 있음</span>}
            </h2>
            <div className="flex items-center gap-2 print:hidden">
              <Button type="button" variant="secondary" size="xs" onClick={downloadExcel} disabled={data.steps.length === 0}>
                엑셀
              </Button>
              <ModalPrintButton />
              <button type="button" onClick={close} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>

          {/* 인쇄 머리(화면에서는 입력칸이 대신함) */}
          <div className="hidden space-y-1 print:block">
            <p className="text-xl font-bold">{data.title}</p>
            <p className="text-sm">
              {projectLabel} · 단위 {data.unit === "day" ? "일(토·일 포함)" : "시간"} · 시작 {startLabel} · 전체 {rangeLabel} · {doneLabel}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 print:hidden">
            <ProjectPicker
              sites={sites}
              projects={projects}
              value={data.project_id}
              onChange={(v) => update({ project_id: v })}
              label="프로젝트"
              emptyLabel="프로젝트를 선택하세요"
            />
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>제목</label>
                <input
                  value={data.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="예: 배관 교체 작업 순서"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <span className={labelClass}>기간 단위</span>
                  <div className="flex gap-3 py-2 text-sm">
                    {(["day", "hour"] as const).map((u) => (
                      <label key={u} className="inline-flex items-center gap-1.5">
                        <input type="radio" name="work-sequence-unit" checked={data.unit === u} onChange={() => changeUnit(u)} />
                        {u === "day" ? "일(날짜)" : "시간"}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>시작일</label>
                  <input
                    type="date"
                    value={data.start_date ?? ""}
                    onChange={(e) => update({ start_date: e.target.value || null })}
                    className={`${inlineFieldClass} w-40`}
                  />
                </div>
                {data.unit === "hour" && (
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>시작 시각</label>
                    <input
                      type="time"
                      value={data.start_time ?? ""}
                      onChange={(e) => update({ start_time: e.target.value || null })}
                      className={`${inlineFieldClass} w-32`}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                작업 순서 <span className="font-normal text-slate-500">— 전체 {rangeLabel}{data.steps.length > 0 && ` (${formatAmount(totalSpan(schedule), data.unit)})`} · {doneLabel}</span>
              </h3>
              <p className="text-xs text-slate-500 print:hidden">순번 숫자를 고치고 Enter를 누르면 그 단계가 그 자리로 옮겨가고 일정도 다시 계산됩니다.</p>
            </div>
            {/* 입력칸으로 된 표 — 휴대폰은 옆으로 넘김(고정 칸 없이) */}
            <div className="overflow-x-auto print:hidden">
              <table className="sticky-col-table w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="w-12 pb-2 pr-2 font-medium">순번</th>
                    <th className="pb-2 pr-2 font-medium">작업 내용</th>
                    <th className="pb-2 pr-2 font-medium">세부 설명·주의사항</th>
                    <th className="w-24 pb-2 pr-2 font-medium">기간({unitLabel})</th>
                    <th className="w-28 pb-2 pr-2 font-medium">앞 작업과 겹침</th>
                    <th className="w-36 pb-2 pr-2 font-medium">일정(자동)</th>
                    <th className="w-40 pb-2 pr-2 font-medium">완료</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.steps.map((s, i) => (
                    <tr key={s.id} className={cx("border-b border-slate-100 align-top", s.done && "bg-emerald-50/60")}>
                      <td className="py-1.5 pr-2">
                        <SeqInput
                          index={i}
                          count={data.steps.length}
                          itemLabel="단계"
                          onMove={(from, to) => setData((d) => ({ ...d, steps: moveListItem(d.steps, from, to) }))}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          value={s.content}
                          onChange={(e) => updateStep(i, { content: e.target.value })}
                          placeholder="예: 기존 배관 철거"
                          aria-label={`${i + 1}번 작업 내용`}
                          className={`${fieldClass} min-w-0`}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <textarea
                          value={s.detail}
                          onChange={(e) => updateStep(i, { detail: e.target.value })}
                          rows={Math.min(4, Math.max(1, s.detail.split("\n").length))}
                          placeholder="할 일·주의할 점"
                          aria-label={`${i + 1}번 세부 설명·주의사항`}
                          className={`${fieldClass} min-w-0`}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={amountStep}
                          step={amountStep}
                          value={s.duration}
                          onChange={(e) => updateStep(i, { duration: Number(e.target.value) })}
                          onBlur={() => updateStep(i, { duration: normalizeAmount(s.duration, data.unit, "duration") })}
                          aria-label={`${i + 1}번 기간`}
                          className={`${inlineFieldClass} w-20`}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        {i === 0 ? (
                          <span className="inline-block py-2 text-slate-300">-</span>
                        ) : (
                          <>
                            <input
                              type="number"
                              min={0}
                              step={amountStep}
                              value={s.overlap}
                              onChange={(e) => updateStep(i, { overlap: Number(e.target.value) })}
                              onBlur={() => setOverlap(i, s.overlap)}
                              aria-label={`${i + 1}번 앞 작업과 겹침`}
                              className={`${inlineFieldClass} w-20`}
                            />
                            {schedule[i]?.overlapClamped && (
                              <p className="mt-0.5 text-[11px] text-red-600">
                                앞 작업 기간보다 길어 {formatAmount(schedule[i].overlap, data.unit)}로 계산
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-2 tabular-nums text-slate-700">{stepRangeLabel(schedule[i], seqStart)}</td>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={s.done}
                            onChange={(e) =>
                              updateStep(i, { done: e.target.checked, done_date: e.target.checked ? s.done_date ?? todayString() : null })
                            }
                            aria-label={`${i + 1}번 완료`}
                            className="h-4 w-4"
                          />
                          {s.done && (
                            <input
                              type="date"
                              value={s.done_date ?? ""}
                              onChange={(e) => updateStep(i, { done_date: e.target.value || null })}
                              aria-label={`${i + 1}번 완료일`}
                              className={`${inlineFieldClass} w-36`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeStep(i)}
                          aria-label={`${i + 1}번 단계 지우기`}
                          className="rounded px-2 py-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.steps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-slate-400">
                        아래 &ldquo;+ 단계 추가&rdquo;로 작업 순서를 적어 주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="print:hidden">
              <Button type="button" variant="secondary" size="sm" onClick={() => update({ steps: [...data.steps, emptyStep()] })}>
                + 단계 추가
              </Button>
            </div>

            {/* 인쇄용 단계 표(입력칸 대신 글자) */}
            <table className="hidden w-full border-collapse text-[11px] print:table">
              <thead>
                <tr>
                  {["순번", "작업 내용", "세부 설명·주의사항", `기간`, "앞과 겹침", "일정", "완료"].map((h) => (
                    <th key={h} className="border border-slate-400 bg-slate-100 px-1.5 py-1 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.steps.map((s, i) => (
                  <tr key={s.id}>
                    <td className="border border-slate-400 px-1.5 py-1 text-center">{i + 1}</td>
                    <td className="border border-slate-400 px-1.5 py-1">{s.content}</td>
                    <td className="whitespace-pre-wrap border border-slate-400 px-1.5 py-1">{s.detail}</td>
                    <td className="border border-slate-400 px-1.5 py-1 text-center">{formatAmount(schedule[i].end - schedule[i].start, data.unit)}</td>
                    <td className="border border-slate-400 px-1.5 py-1 text-center">{i === 0 ? "-" : formatAmount(schedule[i].overlap, data.unit)}</td>
                    <td className="border border-slate-400 px-1.5 py-1">{stepRangeLabel(schedule[i], seqStart)}</td>
                    <td className="border border-slate-400 px-1.5 py-1">{s.done ? `완료 ${s.done_date ?? ""}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-slate-900">
              흐름 차트 <span className="font-normal text-slate-500 print:hidden">— 주황 = 앞 작업과 겹치는 {data.unit === "day" ? "날" : "시간"}, 왼쪽 −/+로 겹침을 바로 고칠 수 있음</span>
            </h3>
            <WorkSequenceChart steps={data.steps} schedule={schedule} seq={seqStart} onOverlapChange={setOverlap} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 print:hidden">{error}</p>}
          <div className="flex items-center gap-2 print:hidden">
            <Button type="button" onClick={save} disabled={!data.project_id || !data.title.trim()}>
              저장
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              닫기
            </Button>
            {(!data.project_id || !data.title.trim()) && (
              <span className="text-xs text-slate-500">프로젝트와 제목을 정하면 저장할 수 있습니다.</span>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
