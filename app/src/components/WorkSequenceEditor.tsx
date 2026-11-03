"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ModalPortal";
import { ModalPrintButton } from "@/components/ModalPrintButton";
import { Button } from "@/components/ui/Button";
import { fieldClass, inlineFieldClass, labelClass } from "@/components/ui/field";
import { SeqInput } from "@/components/ui/SeqInput";
import { ProjectPicker, type ProjectOption, type SiteOption } from "@/components/ProjectPicker";
import { chartLegendTeams, WorkSequenceChart } from "@/components/WorkSequenceChart";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { closePopup } from "@/lib/popupNavigation";
import { moveListItem } from "@/lib/listMove";
import { cx } from "@/lib/cx";
import { nowKstParts } from "@/lib/kstDate";
import { memoFileName } from "@/lib/memoExport";
import { downloadWorkSequenceXlsx } from "@/lib/xlsxExport";
import { saveWorkSequence, setWorkSequenceStepDone } from "@/lib/actions/workSequences";
import {
  chartColumns,
  cleanTeamName,
  delayLabel,
  doneCount,
  forecastSchedule,
  forecastSummary,
  formatAmount,
  NO_TEAM_COLOR,
  NO_TEAM_LABEL,
  nextTeamColor,
  normalizeAmount,
  scheduleSteps,
  sequenceRangeLabel,
  spanRangeLabel,
  statusLabel,
  stepRangeLabel,
  stepStatus,
  TEAM_COLORS,
  TEAM_MAX,
  TEAM_NAME_MAX,
  teamColor,
  teamConflicts,
  teamNameProblem,
  todayOffset,
  totalSpan,
  UNIT_LABEL,
  type SequenceUnit,
  type StepAfter,
  type TeamColorKey,
  type Today,
  type WorkTeam,
} from "@/lib/workSequence";

export type WorkSequenceStepData = {
  id: string;
  content: string;
  detail: string;
  duration: number;
  overlap: number;
  done: boolean;
  done_date: string | null;
  /** 앞 작업으로 고른 단계 id(없으면 바로 앞 단계) — 099 SQL */
  after_step_id: string | null;
  /** 처음부터(순서표 시작에 같이 시작) — 099 SQL */
  after_start: boolean;
  /** 맡은 팀(이 순서표 팀 목록의 id, 없으면 팀 미정) — 100 SQL */
  team_id: string | null;
};

export type WorkSequenceData = {
  id: string;
  project_id: string;
  title: string;
  unit: SequenceUnit;
  start_date: string | null;
  start_time: string | null;
  /** 이 순서표의 팀 목록(이름·색) — 100 SQL */
  teams: WorkTeam[];
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
  after_step_id: null,
  after_start: false,
  team_id: null,
});

/** 팀별 보기에서 "팀 미정" 단계 고르기 */
const NO_TEAM_FOCUS = "__none__";

/** 새로 쓰기·복사 — 순서표·단계 id를 새로 만들고(앞 작업 연결은 새 id로 옮김), 복사면 완료 체크·완료일은 비움. */
function freshCopy(initial: WorkSequenceData): WorkSequenceData {
  const idMap = new Map(initial.steps.map((s) => [s.id, newId()]));
  return {
    ...initial,
    id: newId(),
    steps: initial.steps.map((s) => ({
      ...s,
      id: idMap.get(s.id)!,
      after_step_id: s.after_step_id ? idMap.get(s.after_step_id) ?? null : null,
      done: false,
      done_date: null,
    })),
  };
}

// 공사 작업 순서표 팝업(주소 ?tab=sequence&seq=…, 사용자 요청 11/2) — 프로젝트·제목·단위(일/시간)·시작, 단계 표(순번을 고치면 그 줄이
// 내용째 그 자리로 옮겨감 · 완료 · 작업 내용 · 세부 설명·주의사항 · 앞 작업 · 기간 · 겹침 · 일정(자동)·진행 상태 · 완료일), 흐름 차트
// (겹침 −/+, 오늘 선, 늦은 단계 빨간 테두리). 완료 체크·완료일은 저장된 단계면 바로 저장(현장에서 체크만 — 실패하면 되돌림),
// 나머지는 "저장"을 눌러야 저장 — 저장 안 하고 닫으면 물어봄. "복사"는 저장된 내용으로 새 순서표(완료·시작일·프로젝트는 비움).
// 팀(100 SQL, 사용자 결정 11/2 "순서표마다"): 순서표 위 팀 목록(이름·색 — 색은 정해진 순서로 자동, 다른 순서표에서 쓴 이름은
// 골라 쓰기·그때 색), 단계마다 팀, 차트 색 = 팀, 팀별 보기(그 팀만 진하게 — 인쇄·엑셀은 그 팀 단계만), 같은 팀 일정 겹침 알림
// (완료 단계 빼고, 저장은 막지 않음). 인쇄는 이 팝업만(가로 A4), 엑셀은 지금 화면 내용 그대로.
export function WorkSequenceEditor({
  initial,
  isNew,
  copyOfTitle,
  dependencyReady,
  teamsReady,
  knownTeams,
  sites,
  projects,
  projectLabels,
  closeHref,
  savedHref,
  copyHref,
}: {
  initial: WorkSequenceData;
  isNew: boolean;
  /** 복사해서 새로 쓰는 중이면 원래 순서표 제목 */
  copyOfTitle: string | null;
  /** 099 SQL 실행 뒤(앞 작업 칸이 있음) — 아니면 앞 작업 칸을 숨기고 저장하지 않음 */
  dependencyReady: boolean;
  /** 100 SQL 실행 뒤(팀 칸이 있음) — 아니면 팀 칸을 숨기고 저장하지 않음 */
  teamsReady: boolean;
  /** 다른 순서표에서 쓴 팀 이름·색(팀 추가할 때 골라 쓰기) */
  knownTeams: { name: string; color: TeamColorKey }[];
  sites: SiteOption[];
  projects: ProjectOption[];
  /** 프로젝트 id → "현장 · 프로젝트"(엑셀·인쇄 머리) */
  projectLabels: Record<string, string>;
  closeHref: string;
  /** 새 순서표를 저장한 뒤 주소(…&seq=) — 다시 저장하면 같은 순서표를 고치게 */
  savedHref: string;
  /** 복사해서 새로 쓰기 주소(…&seq=new&copyFrom=) */
  copyHref: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [data, setData] = useState<WorkSequenceData>(() => (isNew ? freshCopy(initial) : initial));
  // 마지막으로 저장된 내용(새 순서표는 아직 없음) — 저장 안 한 변경이 있는지 비교용
  const [saved, setSaved] = useState<WorkSequenceData | null>(() => (isNew ? null : initial));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // 한국 시각 지금 — 진행 상태·오늘 선 기준(기기 시간대와 상관없이)
  const [today] = useState<Today>(nowKstParts);
  const dirty = !saved || JSON.stringify(data) !== JSON.stringify(saved);
  // 팀: 팀별 보기(팀 id·NO_TEAM_FOCUS, null = 전체), 고치는 중인 팀, 새 팀 이름 칸
  const [focusRaw, setFocus] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  const seqStart = { unit: data.unit, start_date: data.start_date, start_time: data.start_time };
  const indexById = useMemo(() => new Map(data.steps.map((s, i) => [s.id, i])), [data.steps]);
  const afterOf = (s: WorkSequenceStepData): StepAfter => {
    if (!dependencyReady) return null;
    if (s.after_start) return "start";
    return s.after_step_id && indexById.has(s.after_step_id) ? indexById.get(s.after_step_id)! : null;
  };
  const schedule = useMemo(
    () => scheduleSteps(data.steps.map((s) => ({ duration: s.duration, overlap: s.overlap, after: afterOf(s) }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.steps, dependencyReady, indexById]
  );
  const statuses = data.steps.map((s, i) => stepStatus(s, schedule[i], seqStart, today));
  const total = totalSpan(schedule);
  // 예상 일정(늦어진 만큼 뒤 단계 밀기, 11/3) — 계획은 그대로, 차트 칸은 예상 끝까지
  const forecast = forecastSchedule(data.steps, schedule, seqStart, today);
  const forecastSum = forecastSummary(forecast, schedule, seqStart, data.steps);
  const forecastEnd = forecast ? forecast.reduce((max, f) => Math.max(max, f.end), 0) : 0;
  const forecastText =
    forecastSum && (forecastSum.allDone || forecastSum.delay !== 0)
      ? `${forecastSum.allDone ? "실제 완료" : "예상 완료"} ${forecastSum.endLabel} (${delayLabel(forecastSum.delay, data.unit)})`
      : null;
  const forecastRange = (i: number) =>
    forecast?.[i]?.changed && !data.steps[i]?.done ? spanRangeLabel(forecast[i].start, forecast[i].end, seqStart) : "";
  const columns = chartColumns(Math.max(total, forecastEnd), seqStart);
  const todayAt = todayOffset(seqStart, today, columns.length);
  const unitLabel = UNIT_LABEL[data.unit];
  const amountStep = data.unit === "day" ? 1 : 0.5;
  const savedStepIds = new Set(saved?.steps.map((s) => s.id) ?? []);

  // 팀(100 SQL 실행 전엔 없음) — 목록에 없는 팀을 가리키면 팀 미정
  const teams = teamsReady ? data.teams : [];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamOf = (s: WorkSequenceStepData) => (s.team_id ? teamById.get(s.team_id) ?? null : null);
  const stepTeamIds = data.steps.map((s) => teamOf(s)?.id ?? null);
  const conflicts = teamConflicts(
    data.steps.map((s, i) => ({ team_id: stepTeamIds[i], done: s.done })),
    schedule
  );
  const conflictPartners = new Map<number, number[]>();
  for (const c of conflicts) {
    conflictPartners.set(c.a, [...(conflictPartners.get(c.a) ?? []), c.b]);
    conflictPartners.set(c.b, [...(conflictPartners.get(c.b) ?? []), c.a]);
  }
  const focus = focusRaw && (focusRaw === NO_TEAM_FOCUS || teamById.has(focusRaw)) ? focusRaw : null;
  const focusMask = focus === null ? null : stepTeamIds.map((id) => (focus === NO_TEAM_FOCUS ? id === null : id === focus));
  const focusName = focus === null ? null : focus === NO_TEAM_FOCUS ? NO_TEAM_LABEL : teamById.get(focus)!.name;
  const inFocus = (i: number) => !focusMask || focusMask[i];
  const editingTeam = editingTeamId ? teamById.get(editingTeamId) ?? null : null;
  const teamStepCount = (id: string) => stepTeamIds.filter((t) => t === id).length;

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
  function addTeam() {
    const name = cleanTeamName(newTeamName);
    if (!name) return;
    if (data.teams.some((t) => cleanTeamName(t.name) === name)) {
      setTeamError(`"${name}" 팀이 이미 있습니다.`);
      return;
    }
    if (data.teams.length >= TEAM_MAX) {
      setTeamError(`팀은 ${TEAM_MAX}개까지 만들 수 있습니다.`);
      return;
    }
    // 다른 순서표에서 쓴 팀이면 그때 색(이 순서표에서 안 쓴 색일 때), 아니면 순서대로 다음 색
    const known = knownTeams.find((k) => k.name === name);
    const color = known && !data.teams.some((t) => t.color === known.color) ? known.color : nextTeamColor(data.teams);
    update({ teams: [...data.teams, { id: newId(), name, color }] });
    setNewTeamName("");
    setTeamError(null);
  }
  function patchTeam(id: string, patch: Partial<WorkTeam>) {
    setData((d) => ({ ...d, teams: d.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }
  async function removeTeam(team: WorkTeam) {
    const n = teamStepCount(team.id);
    if (n > 0 && !(await confirm(`"${team.name}" 팀을 지울까요? 이 팀의 ${n}개 단계는 팀 미정이 됩니다(저장해야 반영됩니다).`))) return;
    setData((d) => ({
      ...d,
      teams: d.teams.filter((t) => t.id !== team.id),
      steps: d.steps.map((s) => (s.team_id === team.id ? { ...s, team_id: null } : s)),
    }));
    setEditingTeamId(null);
  }
  function changeAfter(index: number, value: string) {
    if (value === "start") updateStep(index, { after_step_id: null, after_start: true });
    else updateStep(index, { after_step_id: value || null, after_start: false });
  }
  async function removeStep(index: number) {
    const step = data.steps[index];
    if ((step.content.trim() || step.detail.trim()) && !(await confirm(`${index + 1}번 단계를 지울까요? (저장해야 반영됩니다)`))) return;
    // 이 단계를 앞 작업으로 고른 단계는 바로 앞 단계 뒤로
    setData((d) => ({
      ...d,
      steps: d.steps
        .filter((_, i) => i !== index)
        .map((s) => (s.after_step_id === step.id ? { ...s, after_step_id: null } : s)),
    }));
  }

  // 완료 체크·완료일 — 저장된 단계면 바로 저장하고, 실패하면 원래대로(저장 전 단계는 "저장" 때 같이)
  async function saveDone(index: number, done: boolean, doneDate: string | null) {
    const step = data.steps[index];
    const before = { done: step.done, done_date: step.done_date };
    const next = { done, done_date: done ? doneDate : null };
    updateStep(index, next);
    if (!saved || !savedStepIds.has(step.id)) return;
    setError(null);
    const result = await pending.run(() =>
      setWorkSequenceStepDone({ sequence_id: data.id, id: step.id, done: next.done, done_date: next.done_date })
    );
    const apply = (d: WorkSequenceData, v: typeof next) => ({
      ...d,
      steps: d.steps.map((s) => (s.id === step.id ? { ...s, ...v } : s)),
    });
    if (result?.error) {
      setData((d) => apply(d, before));
      setError(`${index + 1}번 완료 체크를 저장하지 못했습니다: ${result.error}`);
      return;
    }
    setSaved((s) => (s ? apply(s, next) : s));
  }

  async function save() {
    setError(null);
    const teamProblem = teamsReady ? teamNameProblem(data.teams) : null;
    if (teamProblem) {
      setError(teamProblem);
      return;
    }
    const result = await pending.run(() =>
      saveWorkSequence({ ...data, with_dependency: dependencyReady, with_teams: teamsReady })
    );
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaved(data);
    setSavedAt(new Date().toTimeString().slice(0, 5));
    // 새 순서표는 주소를 저장된 순서표로 바꿈(기록은 안 쌓음) — 다시 저장하면 같은 순서표를 고치게
    if (isNew) router.replace(`${savedHref}${data.id}`, { scroll: false });
  }

  async function close() {
    if (dirty && !(await confirm("저장하지 않은 내용이 있습니다. 저장하지 않고 닫을까요?"))) return;
    closePopup(router, closeHref);
  }
  useEscapeKey(true, close);

  async function copy() {
    if (dirty && !(await confirm("저장하지 않은 변경은 복사본에 들어가지 않습니다(저장된 내용으로 복사). 계속할까요?"))) return;
    // 팝업을 복사본으로 바꿈(기록은 안 쌓음 — 닫으면 목록)
    router.replace(`${copyHref}${data.id}`, { scroll: false });
  }

  const projectLabel = projectLabels[data.project_id] ?? "-";
  const startLabel = data.start_date
    ? `${data.start_date}${data.unit === "hour" && data.start_time ? ` ${data.start_time}` : ""}`
    : "-";
  const doneLabel = `${doneCount(data.steps)}/${data.steps.length}단계 완료`;
  const lateCount = statuses.filter((st) => st.state === "overdue").length;
  const rangeLabel = sequenceRangeLabel(schedule, seqStart);
  const afterLabel = (i: number) => {
    const p = schedule[i]?.predecessor;
    if (i === 0) return "-";
    if (p === null || p === undefined) return "처음부터";
    return p === i - 1 ? "바로 앞" : `${p + 1}번 뒤`;
  };

  const conflictText = (i: number) =>
    conflictPartners.has(i) ? `같은 팀 ${conflictPartners.get(i)!.map((n) => n + 1).join("·")}번과 겹침` : "";

  function downloadExcel() {
    // 팀별 보기로 팀을 고르면 그 팀 단계만(순번·일정은 전체 순서표 그대로)
    const picked = data.steps.map((s, i) => ({ s, i })).filter(({ i }) => inFocus(i));
    const pickedDone = picked.filter(({ s }) => s.done).length;
    const pickedLate = picked.filter(({ i }) => statuses[i].state === "overdue").length;
    const pickedDoneLabel = `${pickedDone}/${picked.length}단계 완료`;
    downloadWorkSequenceXlsx(memoFileName(["공사작업순서", projectLabel.split(" · ").pop(), data.title, focusName]), {
      title: `${data.title || "공사 작업 순서"}${focusName ? ` — ${focusName} 일정` : ""}`,
      projectLabel,
      unit: data.unit,
      startLabel,
      rangeLabel: `${rangeLabel} (${formatAmount(total, data.unit)})`,
      doneLabel: pickedLate ? `${pickedDoneLabel} · 지연 ${pickedLate}단계` : pickedDoneLabel,
      forecastLabel: forecastText,
      withTeams: teamsReady && teams.length > 0,
      legendTeams: chartLegendTeams(
        teams,
        picked.map(({ i }) => stepTeamIds[i])
      ),
      steps: picked.map(({ s, i }) => {
        const team = teamOf(s);
        return {
          ...s,
          no: i + 1,
          team: team ? { name: team.name, color: team.color } : null,
          range: stepRangeLabel(schedule[i], seqStart),
          forecast: forecastRange(i),
          forecastSpan: forecastRange(i) ? { start: forecast![i].start, end: forecast![i].end } : null,
          after: afterLabel(i),
          status: [statusLabel(statuses[i]) || (s.done ? "완료" : ""), conflictText(i)].filter(Boolean).join(" · "),
          overdue: statuses[i].state === "overdue",
        };
      }),
      schedule: picked.map(({ i }) => schedule[i]),
      columns,
      todayColumn: todayAt === null ? null : Math.min(columns.length - 1, Math.floor(todayAt)),
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
              {isNew && !saved ? "공사 작업 순서표 작성" : "공사 작업 순서표"}
              {copyOfTitle && isNew && !saved && (
                <span className="ml-2 text-sm font-normal text-slate-500 print:hidden">— &ldquo;{copyOfTitle}&rdquo; 복사</span>
              )}
              {savedAt && !dirty && <span className="ml-2 text-xs font-normal text-emerald-600 print:hidden">{savedAt} 저장됨</span>}
              {dirty && saved && <span className="ml-2 text-xs font-normal text-amber-600 print:hidden">저장 안 한 변경 있음</span>}
            </h2>
            <div className="flex items-center gap-2 print:hidden">
              {saved && (
                <Button type="button" variant="secondary" size="xs" onClick={copy} title="이 순서표를 다른 프로젝트로 복사">
                  복사
                </Button>
              )}
              <Button type="button" variant="secondary" size="xs" onClick={downloadExcel} disabled={data.steps.length === 0}>
                엑셀
              </Button>
              <ModalPrintButton />
              <button type="button" onClick={close} className="text-sm text-slate-500 hover:text-slate-800">
                닫기
              </button>
            </div>
          </div>
          {copyOfTitle && isNew && !saved && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 print:hidden">
              단계·기간·겹침·앞 작업·팀을 그대로 가져왔습니다. 프로젝트와 시작일을 정하고 저장해 주세요(완료 체크는 비움).
            </p>
          )}

          {/* 인쇄 머리(화면에서는 입력칸이 대신함) */}
          <div className="hidden space-y-1 print:block">
            <p className="text-xl font-bold">
              {data.title}
              {focusName && ` — ${focusName} 일정`}
            </p>
            <p className="text-sm">
              {projectLabel} · 단위 {data.unit === "day" ? "일(토·일 포함)" : "시간"} · 시작 {startLabel} · 전체 {rangeLabel} · {doneLabel}
              {lateCount > 0 && ` · 지연 ${lateCount}단계`}
              {forecastText && ` · ${forecastText}`} · {today.date} 기준
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
                작업 순서{" "}
                <span className="font-normal text-slate-500">
                  — 전체 {rangeLabel}
                  {data.steps.length > 0 && ` (${formatAmount(total, data.unit)})`} · {doneLabel}
                </span>
                {lateCount > 0 && <span className="ml-1.5 font-semibold text-red-600">· 지연 {lateCount}단계</span>}
                {forecastText && (
                  <span className={cx("ml-1.5", forecastSum!.delay > 0 ? "font-semibold text-red-600" : "font-normal text-emerald-700")}>
                    · {forecastText}
                  </span>
                )}
                {conflicts.length > 0 && (
                  <span className="ml-1.5 font-semibold text-amber-700 print:hidden">· 같은 팀 일정 겹침 {conflicts.length}건</span>
                )}
              </h3>
              <p className="text-xs text-slate-500 print:hidden">
                순번 숫자를 고치고 Enter를 누르면 그 단계가 그 자리로 옮겨가고 일정도 다시 계산됩니다.
                {saved && " 완료 체크는 바로 저장됩니다."}
              </p>
            </div>
            {teamsReady && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 print:hidden">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="mr-1 font-semibold text-slate-700">팀</span>
                  {data.teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditingTeamId(editingTeamId === t.id ? null : t.id)}
                      aria-label={`${t.name || "(이름 없음)"} 팀 고치기`}
                      aria-expanded={editingTeamId === t.id}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1",
                        editingTeamId === t.id ? "border-slate-800 font-semibold text-slate-900" : "border-slate-200 text-slate-700 hover:border-slate-400"
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: teamColor(t.color).hex }} aria-hidden />
                      {t.name || "(이름 없음)"}
                      <span className="text-slate-400">{teamStepCount(t.id)}</span>
                    </button>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addTeam();
                    }}
                    className="inline-flex items-center gap-1"
                  >
                    <input
                      list="work-sequence-known-teams"
                      value={newTeamName}
                      onChange={(e) => {
                        setNewTeamName(e.target.value);
                        setTeamError(null);
                      }}
                      placeholder="새 팀 이름"
                      maxLength={TEAM_NAME_MAX}
                      aria-label="새 팀 이름"
                      className={`${inlineFieldClass} w-32`}
                    />
                    <datalist id="work-sequence-known-teams">
                      {knownTeams
                        .filter((k) => !data.teams.some((t) => t.name === k.name))
                        .map((k) => (
                          <option key={k.name} value={k.name} />
                        ))}
                    </datalist>
                    <Button type="submit" variant="secondary" size="xs" disabled={!cleanTeamName(newTeamName)}>
                      + 팀 추가
                    </Button>
                  </form>
                </div>
                {teamError && <p className="text-xs text-red-600">{teamError}</p>}
                {editingTeam && (
                  <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex flex-col gap-1">
                      <label className={labelClass} htmlFor="work-sequence-team-name">
                        팀 이름
                      </label>
                      <input
                        id="work-sequence-team-name"
                        value={editingTeam.name}
                        maxLength={TEAM_NAME_MAX}
                        onChange={(e) => patchTeam(editingTeam.id, { name: e.target.value })}
                        onBlur={(e) => patchTeam(editingTeam.id, { name: cleanTeamName(e.target.value) })}
                        className={`${inlineFieldClass} w-40`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={labelClass}>색</span>
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {TEAM_COLORS.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => patchTeam(editingTeam.id, { color: c.key })}
                            aria-label={`색 ${c.label}`}
                            aria-pressed={editingTeam.color === c.key}
                            title={c.label}
                            className={cx(
                              "h-6 w-6 rounded-md",
                              editingTeam.color === c.key ? "ring-2 ring-slate-900 ring-offset-2" : "hover:ring-2 hover:ring-slate-300"
                            )}
                            style={{ background: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="danger" size="xs" onClick={() => removeTeam(editingTeam)}>
                        팀 지우기
                      </Button>
                      <Button type="button" variant="secondary" size="xs" onClick={() => setEditingTeamId(null)} aria-label="팀 고치기 닫기">
                        닫기
                      </Button>
                    </div>
                    {data.teams.some((t) => t.id !== editingTeam.id && t.color === editingTeam.color) && (
                      <p className="w-full text-[11px] text-slate-500">
                        &ldquo;{data.teams.find((t) => t.id !== editingTeam.id && t.color === editingTeam.color)!.name}&rdquo; 팀과 같은
                        색입니다 — 차트에서는 팀 이름으로 구분됩니다.
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  팀을 만들고 단계마다 팀을 고르면 흐름 차트 막대가 팀 색으로 그려집니다.
                  {dependencyReady && " 두 팀이 같이 하는 작업은 팀별로 단계를 나누고 앞 작업을 같은 단계로 고르면 같은 날 나란히 시작합니다."}
                </p>
              </div>
            )}
            {/* 입력칸으로 된 표 — 휴대폰은 옆으로 넘김(고정 칸 없이). 완료 칸을 앞쪽에 둬서 휴대폰에서 넘기지 않고 체크 */}
            <div className="overflow-x-auto print:hidden">
              <table
                className="sticky-col-table w-full text-sm"
                style={{ minWidth: 980 + (dependencyReady ? 140 : 0) + (teamsReady ? 150 : 0) }}
              >
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="w-12 pb-2 pr-2 font-medium">순번</th>
                    <th className="w-12 pb-2 pr-2 font-medium">완료</th>
                    <th className="pb-2 pr-2 font-medium">작업 내용</th>
                    {teamsReady && <th className="w-36 pb-2 pr-2 font-medium">팀</th>}
                    <th className="pb-2 pr-2 font-medium">세부 설명·주의사항</th>
                    {dependencyReady && <th className="w-36 pb-2 pr-2 font-medium">앞 작업</th>}
                    <th className="w-24 pb-2 pr-2 font-medium">기간({unitLabel})</th>
                    <th className="w-24 pb-2 pr-2 font-medium">겹침</th>
                    <th className="w-36 pb-2 pr-2 font-medium">일정(자동)</th>
                    <th className="w-36 pb-2 pr-2 font-medium">완료일</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.steps.map((s, i) => {
                    const st = statuses[i];
                    const label = statusLabel(st);
                    const fromStart = dependencyReady && i > 0 && s.after_start;
                    const pickedIndex = s.after_step_id ? indexById.get(s.after_step_id) : undefined;
                    return (
                      <tr
                        key={s.id}
                        className={cx(
                          "border-b border-slate-100 align-top",
                          s.done ? "bg-emerald-50/60" : st.state === "overdue" ? "bg-red-50/70" : undefined
                        )}
                      >
                        <td className="py-1.5 pr-2">
                          <SeqInput
                            index={i}
                            count={data.steps.length}
                            itemLabel="단계"
                            onMove={(from, to) => setData((d) => ({ ...d, steps: moveListItem(d.steps, from, to) }))}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            checked={s.done}
                            onChange={(e) => saveDone(i, e.target.checked, e.target.checked ? s.done_date ?? today.date : null)}
                            aria-label={`${i + 1}번 완료`}
                            className="h-5 w-5"
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
                        {teamsReady && (
                          <td className="py-1.5 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-3 w-3 shrink-0 rounded-sm"
                                style={{ background: teamColor(teamOf(s)?.color ?? null).hex }}
                                aria-hidden
                              />
                              <select
                                value={teamOf(s)?.id ?? ""}
                                onChange={(e) => updateStep(i, { team_id: e.target.value || null })}
                                aria-label={`${i + 1}번 팀`}
                                className={`${inlineFieldClass} w-28`}
                              >
                                <option value="">{NO_TEAM_LABEL}</option>
                                {data.teams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name || "(이름 없음)"}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                        )}
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
                        {dependencyReady && (
                          <td className="py-1.5 pr-2">
                            {i === 0 ? (
                              <span className="inline-block py-2 text-slate-300">처음</span>
                            ) : (
                              <>
                                <select
                                  value={s.after_start ? "start" : s.after_step_id ?? ""}
                                  onChange={(e) => changeAfter(i, e.target.value)}
                                  aria-label={`${i + 1}번 앞 작업`}
                                  className={`${inlineFieldClass} w-36`}
                                >
                                  <option value="">바로 앞({i}번)</option>
                                  <option value="start">처음부터</option>
                                  {data.steps.slice(0, i - 1).map((p, j) => (
                                    <option key={p.id} value={p.id}>
                                      {j + 1}번 뒤 · {p.content.slice(0, 10) || "(내용 없음)"}
                                    </option>
                                  ))}
                                  {/* 순번을 바꿔 뒤로 간 단계를 가리키고 있으면 그대로 보여 줌(바로 앞 기준으로 계산 중) */}
                                  {pickedIndex !== undefined && pickedIndex >= i - 1 && pickedIndex !== i - 1 && (
                                    <option value={s.after_step_id!}>
                                      {pickedIndex + 1}번(뒤 순번) · {data.steps[pickedIndex].content.slice(0, 8)}
                                    </option>
                                  )}
                                  {pickedIndex === i - 1 && <option value={s.after_step_id!}>{i}번 뒤</option>}
                                </select>
                                {schedule[i]?.afterInvalid && (
                                  <p className="mt-0.5 text-[11px] text-red-600">뒤 순번이라 바로 앞 단계 기준으로 계산</p>
                                )}
                              </>
                            )}
                          </td>
                        )}
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
                          {i === 0 || fromStart ? (
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
                        <td className="py-2 pr-2">
                          <p className="whitespace-nowrap tabular-nums text-slate-700">{stepRangeLabel(schedule[i], seqStart)}</p>
                          {label && (
                            <p
                              className={cx(
                                "text-[11px] font-semibold",
                                st.state === "overdue" || st.state === "doneLate" ? "text-red-600" : "text-sky-700"
                              )}
                            >
                              {label}
                            </p>
                          )}
                          {conflictPartners.has(i) && <p className="text-[11px] font-semibold text-amber-700">{conflictText(i)}</p>}
                          {forecastRange(i) && (
                            <p className="whitespace-nowrap text-[11px] text-slate-600" title="늦어진 앞 작업만큼 밀린 예상 일정">
                              예상 {forecastRange(i)}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {s.done ? (
                            <input
                              type="date"
                              value={s.done_date ?? ""}
                              onChange={(e) => saveDone(i, true, e.target.value || null)}
                              aria-label={`${i + 1}번 완료일`}
                              className={`${inlineFieldClass} w-36`}
                            />
                          ) : (
                            <span className="inline-block py-2 text-slate-300">-</span>
                          )}
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
                    );
                  })}
                  {data.steps.length === 0 && (
                    <tr>
                      <td colSpan={9 + (dependencyReady ? 1 : 0) + (teamsReady ? 1 : 0)} className="py-6 text-center text-sm text-slate-400">
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
                  {[
                    "순번",
                    "작업 내용",
                    ...(teams.length > 0 ? ["팀"] : []),
                    "세부 설명·주의사항",
                    ...(dependencyReady ? ["앞 작업"] : []),
                    "기간",
                    "겹침",
                    "일정",
                    "상태",
                    "완료",
                  ].map(
                    (h) => (
                      <th key={h} className="border border-slate-400 bg-slate-100 px-1.5 py-1 text-left">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.steps.map((s, i) =>
                  !inFocus(i) ? null : (
                  <tr key={s.id}>
                    <td className="border border-slate-400 px-1.5 py-1 text-center">{i + 1}</td>
                    <td className="border border-slate-400 px-1.5 py-1">{s.content}</td>
                    {teams.length > 0 && (
                      <td className="border border-slate-400 px-1.5 py-1">
                        {teamOf(s) ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: teamColor(teamOf(s)!.color).hex }} />
                            {teamOf(s)!.name}
                          </span>
                        ) : (
                          NO_TEAM_LABEL
                        )}
                      </td>
                    )}
                    <td className="whitespace-pre-wrap border border-slate-400 px-1.5 py-1">{s.detail}</td>
                    {dependencyReady && <td className="border border-slate-400 px-1.5 py-1 text-center">{afterLabel(i)}</td>}
                    <td className="border border-slate-400 px-1.5 py-1 text-center">{formatAmount(schedule[i].end - schedule[i].start, data.unit)}</td>
                    <td className="border border-slate-400 px-1.5 py-1 text-center">
                      {i === 0 || schedule[i].predecessor === null ? "-" : formatAmount(schedule[i].overlap, data.unit)}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1">
                      {stepRangeLabel(schedule[i], seqStart)}
                      {forecastRange(i) && <div>예상 {forecastRange(i)}</div>}
                    </td>
                    <td className={cx("border border-slate-400 px-1.5 py-1", statuses[i].state === "overdue" && "font-semibold text-red-600")}>
                      {[statusLabel(statuses[i]), conflictText(i)].filter(Boolean).join(" · ")}
                    </td>
                    <td className="border border-slate-400 px-1.5 py-1">{s.done ? `완료 ${s.done_date ?? ""}` : ""}</td>
                  </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-slate-900">
              흐름 차트{focusName && <span className="font-normal"> — {focusName}</span>}{" "}
              <span className="font-normal text-slate-500 print:hidden">
                — {teams.length > 0 ? "색 = 팀, " : ""}빗금 = 앞 작업과 겹치는 {data.unit === "day" ? "날" : "시간"}, 왼쪽 −/+로 겹침을
                바로 고칠 수 있음
              </span>
            </h3>
            {teams.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs print:hidden">
                <span className="mr-1 font-semibold text-slate-700">팀별 보기</span>
                <FocusChip active={focus === null} onClick={() => setFocus(null)}>
                  전체
                </FocusChip>
                {teams.map((t) => (
                  <FocusChip key={t.id} active={focus === t.id} color={teamColor(t.color).hex} onClick={() => setFocus(focus === t.id ? null : t.id)}>
                    {t.name || "(이름 없음)"}
                  </FocusChip>
                ))}
                {stepTeamIds.some((id) => id === null) && (
                  <FocusChip
                    active={focus === NO_TEAM_FOCUS}
                    color={NO_TEAM_COLOR.hex}
                    onClick={() => setFocus(focus === NO_TEAM_FOCUS ? null : NO_TEAM_FOCUS)}
                  >
                    {NO_TEAM_LABEL}
                  </FocusChip>
                )}
                {focusName && <span className="text-slate-500">— {focusName} 단계만 진하게 · 인쇄·엑셀은 이 팀 단계만</span>}
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">
                <p className="font-semibold">
                  같은 팀 일정 겹침 {conflicts.length}건 — 같은 팀이 같은 {data.unit === "day" ? "날" : "시간"}에 두 작업입니다. 일손이
                  되는지 확인해 주세요(저장은 됩니다).
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {conflicts.slice(0, 8).map((c) => (
                    <li key={`${c.a}-${c.b}`}>
                      {teamById.get(c.teamId)?.name}: {c.a + 1}번 {shortText(data.steps[c.a].content)} · {c.b + 1}번{" "}
                      {shortText(data.steps[c.b].content)} ({spanRangeLabel(c.start, c.end, seqStart)})
                    </li>
                  ))}
                  {conflicts.length > 8 && <li>외 {conflicts.length - 8}건</li>}
                </ul>
              </div>
            )}
            <WorkSequenceChart
              steps={data.steps.map((s) => ({ content: s.content, done: s.done, team: teamOf(s) }))}
              schedule={schedule}
              seq={seqStart}
              statuses={statuses}
              todayAt={todayAt}
              forecast={forecast}
              focus={focusMask}
              teamConflictSteps={new Set(conflictPartners.keys())}
              legendTeams={chartLegendTeams(teams, stepTeamIds)}
              onOverlapChange={setOverlap}
            />
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

const shortText = (text: string) => (text.length > 12 ? `${text.slice(0, 12)}…` : text || "(내용 없음)");

function FocusChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1",
        active ? "border-slate-800 font-semibold text-slate-900 ring-1 ring-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-400"
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}
