// 공사 작업 순서 일정 계산(사용자 결정 11/2: "기간 + 앞 작업과 겹침 → 날짜 자동", 단위는 순서표마다 일 또는 시간, 토·일 포함
// 달력 그대로 — 검사: workSequence.test.ts). 날짜는 저장하지 않고 늘 여기서 계산해서, 순번을 바꾸거나 기간·겹침을 고치면 날짜가
// 저절로 다시 맞춰짐(098 SQL).
//  - 1번 단계는 순서표 시작에 시작
//  - n번 단계 시작 = 앞 작업 끝 − 겹침(겹침 0 = 앞 작업이 끝난 다음에 시작). 겹침은 앞 작업 기간까지만 — 더 크면 앞 작업보다 먼저
//    시작하게 돼서 앞 작업 기간으로 줄여 계산하고 화면에 알림(overlapClamped)
//  - 앞 작업(099 SQL, 사용자 요청 11/2 "앞 작업 지정 — 동시에 여러 작업"): 기본은 바로 앞 단계, "처음부터"(순서표 시작에 같이
//    시작), 또는 앞 순번의 단계 하나(그 단계 뒤에 — 여러 단계가 같은 단계 뒤에 동시에 시작할 수 있음). 고른 단계가 순번을 바꿔
//    이 단계보다 뒤로 갔으면 바로 앞 단계 기준으로 계산하고 알림(afterInvalid) — 서로 물려 끝없이 도는 일이 없게 앞 순번만
//  - 일 단위: 단계는 시작일부터 기간만큼의 날(끝날 포함) — 11-10 시작 3일 작업은 11-10~11-12
//  - 시간 단위: 시작 시각부터 기간만큼 쉬지 않고 이어서 — 08:00 시작 3시간 작업은 08:00~11:00(자정을 넘으면 날짜도 바뀜)

export type SequenceUnit = "day" | "hour";
export const UNIT_LABEL: Record<SequenceUnit, string> = { day: "일", hour: "시간" };

/** 앞 작업 — 단계 위치(0부터), "start" = 처음부터, null = 바로 앞 단계(기본) */
export type StepAfter = number | "start" | null;
export type StepInput = { duration: number; overlap: number; after?: StepAfter };
export type ScheduledStep = {
  /** 순서표 시작부터(일 또는 시간) */
  start: number;
  end: number;
  /** 실제로 적용한 겹침(앞 작업 기간까지만) */
  overlap: number;
  /** 적은 겹침이 앞 작업 기간보다 커서 줄였음 */
  overlapClamped: boolean;
  /** 실제로 이어 붙인 앞 작업 위치(null = 순서표 시작에서 시작) */
  predecessor: number | null;
  /** 고른 앞 작업이 이 단계보다 뒤(또는 자기 자신)라서 바로 앞 단계 기준으로 계산함 */
  afterInvalid: boolean;
};

/** 기간·겹침 입력값 정리 — 일은 정수, 시간은 0.5 단위. 기간은 최소 1일·0.5시간, 겹침은 0 이상. */
export function normalizeAmount(value: number, unit: SequenceUnit, kind: "duration" | "overlap"): number {
  const v = Number.isFinite(value) ? value : 0;
  const rounded = unit === "day" ? Math.round(v) : Math.round(v * 2) / 2;
  const min = kind === "duration" ? (unit === "day" ? 1 : 0.5) : 0;
  return Math.max(min, rounded);
}

export function scheduleSteps(steps: StepInput[]): ScheduledStep[] {
  const out: ScheduledStep[] = [];
  steps.forEach((s, i) => {
    const duration = Math.max(0, Number(s.duration) || 0);
    let predecessor: number | null = i === 0 ? null : i - 1;
    let afterInvalid = false;
    if (s.after === "start") predecessor = null;
    else if (typeof s.after === "number") {
      if (Number.isInteger(s.after) && s.after >= 0 && s.after < i) predecessor = s.after;
      else afterInvalid = true;
    }
    if (predecessor === null) {
      out.push({ start: 0, end: duration, overlap: 0, overlapClamped: false, predecessor, afterInvalid });
      return;
    }
    const prev = out[predecessor];
    const prevDuration = prev.end - prev.start;
    const wanted = Math.max(0, Number(s.overlap) || 0);
    const overlap = Math.min(wanted, prevDuration);
    const start = prev.end - overlap;
    out.push({ start, end: start + duration, overlap, overlapClamped: wanted > prevDuration, predecessor, afterInvalid });
  });
  return out;
}

/** 전체 기간(가장 늦게 끝나는 단계의 끝) — 겹침 때문에 마지막 단계가 가장 늦게 끝나지 않을 수도 있음. */
export function totalSpan(schedule: ScheduledStep[]): number {
  return schedule.reduce((max, s) => Math.max(max, s.end), 0);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const isYmd = (s: string | null | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

/** 시작일에서 offset일 뒤의 날짜(YYYY-MM-DD) — 시간대와 상관없게 UTC로 셈. */
export function addDays(ymd: string, offset: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
}

export function weekdayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 시작 날짜·시각에서 offset시간 뒤 — { date: YYYY-MM-DD, time: HH:MM } */
export function addHours(ymd: string, hhmm: string | null | undefined, offset: number): { date: string; time: string } {
  const [h, mi] = (hhmm && /^\d{1,2}:\d{2}/.test(hhmm) ? hhmm : "00:00").split(":").map(Number);
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi) + Math.round(offset * 60) * 60_000);
  const iso = t.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const md = (ymd: string) => ymd.slice(5);

/** "3일", "1.5시간" */
export function formatAmount(n: number, unit: SequenceUnit): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}${UNIT_LABEL[unit]}`;
}

export type SequenceStart = { unit: SequenceUnit; start_date: string | null; start_time: string | null };

/**
 * 단계 일정 글자 — 일: "11-10~11-12"(하루면 "11-10"), 시간: "11-10 08:00~11:00"(날짜가 바뀌면 "11-10 22:00~11-11 02:00").
 * 시작일이 없으면 순서표 시작 기준 — 일: "1일째~3일째", 시간: "+0~+3시간".
 */
export function stepRangeLabel(step: ScheduledStep, seq: SequenceStart): string {
  return spanRangeLabel(step.start, step.end, seq);
}

/** 순서표 시작부터 [start, end) 구간의 일정 글자 — stepRangeLabel과 같은 모양(팀 일정 겹침 구간 등). */
export function spanRangeLabel(start: number, end: number, seq: SequenceStart): string {
  const step = { start, end };
  if (seq.unit === "day") {
    const first = Math.floor(step.start);
    const last = Math.max(first, Math.ceil(step.end) - 1);
    if (!isYmd(seq.start_date)) return first === last ? `${first + 1}일째` : `${first + 1}일째~${last + 1}일째`;
    const a = md(addDays(seq.start_date, first));
    const b = md(addDays(seq.start_date, last));
    return a === b ? a : `${a}~${b}`;
  }
  if (!isYmd(seq.start_date)) return `+${formatHours(step.start)}~+${formatHours(step.end)}시간`;
  const a = addHours(seq.start_date, seq.start_time, step.start);
  const b = addHours(seq.start_date, seq.start_time, step.end);
  return a.date === b.date ? `${md(a.date)} ${a.time}~${b.time}` : `${md(a.date)} ${a.time}~${md(b.date)} ${b.time}`;
}

const formatHours = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** 순서표 전체의 시작~끝 글자(목록·엑셀용) — 단계가 없으면 "-". */
export function sequenceRangeLabel(schedule: ScheduledStep[], seq: SequenceStart): string {
  if (schedule.length === 0) return "-";
  return spanRangeLabel(0, totalSpan(schedule), seq);
}

export type ChartColumn = { label: string; sub: string; weekend: boolean };

/**
 * 흐름 차트 칸(일 단위는 하루 한 칸, 시간 단위는 한 시간 한 칸) — 머리글 글자. 일: "11-10"/"월"(토·일 표시),
 * 시간: "08"(시)/날짜가 바뀌는 칸에 "11-11". 시작일이 없으면 "1"·"2"…(일째·시간째).
 */
export function chartColumns(total: number, seq: SequenceStart): ChartColumn[] {
  const count = Math.max(1, Math.ceil(total));
  return Array.from({ length: count }, (_, i) => {
    if (seq.unit === "day") {
      if (!isYmd(seq.start_date)) return { label: String(i + 1), sub: "", weekend: false };
      const date = addDays(seq.start_date, i);
      const wd = weekdayOf(date);
      return { label: md(date), sub: wd, weekend: wd === "토" || wd === "일" };
    }
    if (!isYmd(seq.start_date)) return { label: String(i), sub: "", weekend: false };
    const at = addHours(seq.start_date, seq.start_time, i);
    const prev = i === 0 ? null : addHours(seq.start_date, seq.start_time, i - 1);
    return { label: at.time.slice(0, 2), sub: !prev || prev.date !== at.date ? md(at.date) : "", weekend: false };
  });
}

/** 완료 단계 수 */
export function doneCount(steps: { done: boolean }[]): number {
  return steps.filter((s) => s.done).length;
}

// ── 오늘 기준 진행 상태(사용자 요청 11/2 "오늘 표시·지연 알림") ─────────────────────────────────────────────────────────
// 계획 끝(일: 끝날, 시간: 끝 시각)이 지났는데 완료 체크가 없으면 "지남", 완료일이 계획 끝날보다 늦으면 "늦게 완료", 오늘이 계획 안이면
// "진행 중". 시작일이 없는 순서표는 날짜를 모르므로 판단하지 않음. today = 한국 시각 { date: YYYY-MM-DD, time: HH:MM }.

export type Today = { date: string; time: string };
export type StepState = "done" | "doneLate" | "overdue" | "inProgress" | "upcoming" | "noDate";
export type StepStatus = { state: StepState; /** 늦은 정도 — 일 단위는 일, 시간 단위의 "지남"은 시간 */ lateBy: number; lateUnit: SequenceUnit };

const dayIndex = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;
/** a → b 며칠(b가 늦으면 양수) */
export const daysBetween = (a: string, b: string) => dayIndex(b) - dayIndex(a);

/** 단계의 계획 시작·끝 — 일: 날짜(끝날 포함), 시간: "YYYY-MM-DD HH:MM". 시작일이 없으면 null. */
export function plannedRange(step: ScheduledStep, seq: SequenceStart): { start: string; end: string } | null {
  if (!isYmd(seq.start_date)) return null;
  if (seq.unit === "day") {
    const first = Math.floor(step.start);
    const last = Math.max(first, Math.ceil(step.end) - 1);
    return { start: addDays(seq.start_date, first), end: addDays(seq.start_date, last) };
  }
  const a = addHours(seq.start_date, seq.start_time, step.start);
  const b = addHours(seq.start_date, seq.start_time, step.end);
  return { start: `${a.date} ${a.time}`, end: `${b.date} ${b.time}` };
}

export function stepStatus(
  step: { done: boolean; done_date: string | null },
  scheduled: ScheduledStep,
  seq: SequenceStart,
  today: Today
): StepStatus {
  const range = plannedRange(scheduled, seq);
  if (!range) return { state: step.done ? "done" : "noDate", lateBy: 0, lateUnit: "day" };
  const endDate = range.end.slice(0, 10);
  if (step.done) {
    if (isYmd(step.done_date) && step.done_date > endDate) {
      return { state: "doneLate", lateBy: daysBetween(endDate, step.done_date), lateUnit: "day" };
    }
    return { state: "done", lateBy: 0, lateUnit: "day" };
  }
  if (seq.unit === "day") {
    if (today.date > range.end) return { state: "overdue", lateBy: daysBetween(range.end, today.date), lateUnit: "day" };
    return { state: today.date >= range.start ? "inProgress" : "upcoming", lateBy: 0, lateUnit: "day" };
  }
  const now = `${today.date} ${today.time}`;
  if (now > range.end) {
    const minutes =
      (dayIndex(today.date) - dayIndex(endDate)) * 1440 +
      (Number(today.time.slice(0, 2)) * 60 + Number(today.time.slice(3, 5))) -
      (Number(range.end.slice(11, 13)) * 60 + Number(range.end.slice(14, 16)));
    return { state: "overdue", lateBy: Math.ceil(minutes / 30) / 2, lateUnit: "hour" };
  }
  return { state: now >= range.start ? "inProgress" : "upcoming", lateBy: 0, lateUnit: "hour" };
}

/** "2일 지남", "3시간 지남"(24시간 넘으면 일), "1일 늦게 완료", "진행 중" — 예정·완료·날짜 없음은 빈 글자 */
export function statusLabel(status: StepStatus): string {
  const amount = () =>
    status.lateUnit === "hour" && status.lateBy < 24
      ? `${formatHours(status.lateBy)}시간`
      : `${status.lateUnit === "hour" ? Math.floor(status.lateBy / 24) : status.lateBy}일`;
  switch (status.state) {
    case "overdue":
      return `${amount()} 지남`;
    case "doneLate":
      return `${status.lateBy}일 늦게 완료`;
    case "inProgress":
      return "진행 중";
    default:
      return "";
  }
}

/** 흐름 차트의 오늘(지금) 위치 — 순서표 시작부터 몇 칸째(일: 오늘 칸 가운데, 시간: 지금 시각). 차트 밖이면 null. */
export function todayOffset(seq: SequenceStart, today: Today, columns: number): number | null {
  if (!isYmd(seq.start_date)) return null;
  let at: number;
  if (seq.unit === "day") at = daysBetween(seq.start_date, today.date) + 0.5;
  else {
    const [h, mi] = (seq.start_time && /^\d{1,2}:\d{2}/.test(seq.start_time) ? seq.start_time : "00:00").split(":").map(Number);
    const startMinutes = h * 60 + mi;
    const nowMinutes = Number(today.time.slice(0, 2)) * 60 + Number(today.time.slice(3, 5));
    at = (daysBetween(seq.start_date, today.date) * 1440 + nowMinutes - startMinutes) / 60;
  }
  return at >= 0 && at <= columns ? at : null;
}

export type SequenceSummary = { label: string; tone: "done" | "late" | "active" | "upcoming" | "none"; rank: number };

/** 목록의 상태 칸 — 지연 N단계 / 진행 중 / 예정 / 완료 / 시작일 없음. rank는 정렬용(지연이 클수록 큼). */
export function summarizeSequence(
  steps: { done: boolean; done_date: string | null }[],
  schedule: ScheduledStep[],
  seq: SequenceStart,
  today: Today
): SequenceSummary {
  if (steps.length === 0) return { label: "-", tone: "none", rank: 0 };
  if (steps.every((s) => s.done)) return { label: "완료", tone: "done", rank: 1 };
  if (!isYmd(seq.start_date)) return { label: "시작일 없음", tone: "none", rank: 0 };
  const statuses = steps.map((s, i) => stepStatus(s, schedule[i], seq, today));
  const overdue = statuses.filter((st) => st.state === "overdue").length;
  if (overdue > 0) return { label: `지연 ${overdue}단계`, tone: "late", rank: 100 + overdue };
  const started = statuses.some((st) => st.state !== "upcoming");
  return started ? { label: "진행 중", tone: "active", rank: 3 } : { label: "예정", tone: "upcoming", rank: 2 };
}

// ── 팀(사용자 결정 11/2 "순서표마다" + "같은 팀 일정 겹침 알림", 100 SQL) ──────────────────────────────────────────────
// 흐름 차트에서 색 = 팀, 모양 = 상태(완료 옅게 + ✓, 늦음 빨간 테두리 + !, 앞 작업과 겹침 빗금). 팀 색은 정해진 순서로 자동(바꿀 수
// 있음) — 이웃한 색끼리 색약에서도 구분되는 순서(색 구분 검사 통과). 빨강은 "계획보다 늦음" 전용이라 팀 색에서 뺌. 팀을 안 정한
// 단계는 남색(예전 막대 색 — 팀을 안 쓰는 순서표는 예전 모습 그대로). 색만으로 확실히 구분되는 건 3~4팀까지라 막대·왼쪽 칸에 팀
// 이름도 늘 같이 씀. 팀 목록은 순서표마다(work_sequences.teams), 단계는 그 목록의 팀 id(work_sequence_steps.team_id).

export const TEAM_COLORS = [
  { key: "blue", label: "파랑", hex: "#2a78d6", ink: "#ffffff" },
  { key: "orange", label: "주황", hex: "#eb6834", ink: "#ffffff" },
  { key: "aqua", label: "청록", hex: "#1baf7a", ink: "#ffffff" },
  { key: "yellow", label: "노랑", hex: "#eda100", ink: "#0b0b0b" },
  { key: "magenta", label: "분홍", hex: "#e87ba4", ink: "#ffffff" },
  { key: "green", label: "초록", hex: "#008300", ink: "#ffffff" },
  { key: "violet", label: "보라", hex: "#6250d6", ink: "#ffffff" },
] as const;
export type TeamColorKey = (typeof TEAM_COLORS)[number]["key"];
export type TeamColor = { hex: string; ink: string; label: string };
/** 팀 미정 = 예전 막대 색(brand-navy) */
export const NO_TEAM_COLOR: TeamColor = { hex: "#0c3560", ink: "#ffffff", label: "남색" };
export const NO_TEAM_LABEL = "팀 미정";
export const TEAM_NAME_MAX = 20;
export const TEAM_MAX = 30;

export type WorkTeam = { id: string; name: string; color: TeamColorKey };

export function isTeamColorKey(value: unknown): value is TeamColorKey {
  return TEAM_COLORS.some((c) => c.key === value);
}

export function teamColor(key: TeamColorKey | null | undefined): TeamColor {
  const c = TEAM_COLORS.find((x) => x.key === key);
  return c ? { hex: c.hex, ink: c.ink, label: c.label } : NO_TEAM_COLOR;
}

/** 새 팀 색 — 아직 안 쓴 색 중 순서상 첫째. 7색을 다 쓰면 가장 적게 쓴 색(같으면 앞 순서) — 이때는 팀 이름으로 구분. */
export function nextTeamColor(teams: { color: TeamColorKey }[]): TeamColorKey {
  const used = new Map<TeamColorKey, number>();
  for (const t of teams) used.set(t.color, (used.get(t.color) ?? 0) + 1);
  let best: TeamColorKey = TEAM_COLORS[0].key;
  let bestCount = Infinity;
  for (const c of TEAM_COLORS) {
    const n = used.get(c.key) ?? 0;
    if (n < bestCount) {
      best = c.key;
      bestCount = n;
    }
  }
  return best;
}

/** 팀 이름 정리 — 앞뒤 공백·연속 공백을 줄이고 TEAM_NAME_MAX자까지 */
export function cleanTeamName(name: unknown): string {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEAM_NAME_MAX);
}

/**
 * DB(jsonb)·화면에서 온 팀 목록 정리 — 배열이 아니면 빈 목록, id·이름이 없는 항목은 뺌, 같은 id는 처음 것만, 색이 이상하면 새 색,
 * TEAM_MAX개까지. 이름이 같은 팀도 id가 다르면 그대로 둠(화면이 같은 이름을 막음).
 */
export function parseTeams(raw: unknown): WorkTeam[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkTeam[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim().slice(0, 64) : "";
    const name = cleanTeamName(r.name);
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);
    out.push({ id, name, color: isTeamColorKey(r.color) ? r.color : nextTeamColor(out) });
    if (out.length >= TEAM_MAX) break;
  }
  return out;
}

/** 색을 흰색과 섞은 색(#rrggbb) — share = 원래 색의 비율(0~1). 완료 막대(옅게)·엑셀 칸 색. */
export function tintHex(hex: string, share: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const s = Math.min(1, Math.max(0, share));
  const mix = (c: number) => Math.round(c * s + 255 * (1 - s));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export type TeamConflict = {
  teamId: string;
  /** 단계 위치(0부터, a < b) */
  a: number;
  b: number;
  /** 겹치는 구간(순서표 시작부터) */
  start: number;
  end: number;
};

/**
 * 같은 팀 일정 겹침(사용자 요청 11/2 "같은 팀이 같은 날 두 작업이면 알림" — 일손 확인용, 저장은 막지 않음). 완료 체크한 단계와 팀
 * 미정 단계는 빼고, 같은 팀 두 단계의 일정 [시작, 끝)이 겹치면 한 건. 끝과 시작이 맞닿기만 하면(앞 단계가 끝난 다음 시작) 겹침 아님.
 */
export function teamConflicts(steps: { team_id: string | null; done: boolean }[], schedule: ScheduledStep[]): TeamConflict[] {
  const out: TeamConflict[] = [];
  for (let a = 0; a < steps.length; a++) {
    const ta = steps[a].team_id;
    if (!ta || steps[a].done || !schedule[a]) continue;
    for (let b = a + 1; b < steps.length; b++) {
      if (steps[b].team_id !== ta || steps[b].done || !schedule[b]) continue;
      const start = Math.max(schedule[a].start, schedule[b].start);
      const end = Math.min(schedule[a].end, schedule[b].end);
      if (end - start > 1e-9) out.push({ teamId: ta, a, b, start, end });
    }
  }
  return out;
}

/** 저장 전 팀 이름 확인 — 빈 이름·같은 이름이면 안내 글자, 괜찮으면 null(화면·서버 같이 씀). */
export function teamNameProblem(teams: { name: unknown }[]): string | null {
  if (teams.length > TEAM_MAX) return `팀은 ${TEAM_MAX}개까지 만들 수 있습니다.`;
  const names = teams.map((t) => cleanTeamName(t.name));
  if (names.some((n) => !n)) return "이름이 빈 팀이 있습니다. 팀 이름을 입력해주세요.";
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) return `"${n}" 팀이 두 개 있습니다. 팀 이름을 다르게 해주세요.`;
    seen.add(n);
  }
  return null;
}

// ── 예상 일정(사용자 요청 11/3 "1-3번" 중 1번 — 늦어진 만큼 뒤 단계 밀기) ──────────────────────────────────────────────
// 계획(scheduleSteps)은 그대로 두고 실제 진행을 반영한 예상만 따로 계산(저장하지 않음):
//  - 완료한 단계: 완료일에 끝난 것으로(완료일이 없으면 계획 끝 — 오늘보다 늦지 않게). 시간 단위는 완료일이 날짜뿐이라 계획 끝 날짜에
//    완료했으면 계획대로, 그 뒤 날짜면 그날 끝(24시)에 끝난 것으로
//  - 완료 안 한 단계: 시작 = 계획 시작과 (앞 작업 예상 끝 − 겹침) 중 늦은 쪽 — 앞 작업이 일찍 끝나도 당겨 시작하지 않음(팀 일정은
//    계획대로 잡혀 있으므로). 끝 = 시작 + 기간, 그 끝이 이미 지났으면 오늘(시간 단위는 지금) 끝나는 것으로(아직 안 끝났으니 가장 이른 끝)
//  - 시작일이 없는 순서표는 날짜를 모르므로 계산하지 않음(null)
export type ForecastStep = {
  start: number;
  end: number;
  /** 완료 안 한 단계 중 계획과 달라진 것(밀리거나 늘어남) — 차트에 점선 막대 */
  changed: boolean;
};

const startHoursOf = (seq: SequenceStart) => {
  const [h, mi] = (seq.start_time && /^\d{1,2}:\d{2}/.test(seq.start_time) ? seq.start_time : "00:00").split(":").map(Number);
  return h + mi / 60;
};

/** 지금이 순서표 시작부터 어디쯤인지 — 일: 오늘 칸 번호(0부터), 시간: 시작부터 지난 시간 */
function nowOffset(seq: SequenceStart & { start_date: string }, today: Today): number {
  const days = daysBetween(seq.start_date, today.date);
  if (seq.unit === "day") return days;
  return days * 24 + Number(today.time.slice(0, 2)) + Number(today.time.slice(3, 5)) / 60 - startHoursOf(seq);
}

/** 그 날짜가 끝나는 때(다음 날 0시)가 순서표 시작부터 어디인지 */
function dateEndOffset(seq: SequenceStart & { start_date: string }, ymd: string): number {
  const days = daysBetween(seq.start_date, ymd) + 1;
  return seq.unit === "day" ? days : days * 24 - startHoursOf(seq);
}

/** [start, end) 구간이 걸친 날짜(끝날 포함) — 시간 단위는 0시에 끝나면 그 전날까지 */
export function spanDates(start: number, end: number, seq: SequenceStart): { from: string; to: string } | null {
  if (!isYmd(seq.start_date)) return null;
  if (seq.unit === "day") {
    const first = Math.floor(start);
    const last = Math.max(first, Math.ceil(end) - 1);
    return { from: addDays(seq.start_date, first), to: addDays(seq.start_date, last) };
  }
  const a = addHours(seq.start_date, seq.start_time, start);
  const b = addHours(seq.start_date, seq.start_time, end);
  const to = b.time === "00:00" && end > start ? addDays(b.date, -1) : b.date;
  return { from: a.date, to: to < a.date ? a.date : to };
}

export function forecastSchedule(
  steps: { done: boolean; done_date: string | null }[],
  schedule: ScheduledStep[],
  seq: SequenceStart,
  today: Today
): ForecastStep[] | null {
  if (!isYmd(seq.start_date)) return null;
  const s0 = { ...seq, start_date: seq.start_date };
  const now = nowOffset(s0, today);
  const out: ForecastStep[] = [];
  steps.forEach((step, i) => {
    const plan = schedule[i] ?? { start: 0, end: 0, overlap: 0, overlapClamped: false, predecessor: null, afterInvalid: false };
    const duration = plan.end - plan.start;
    const pred = plan.predecessor;
    const start = pred !== null && out[pred] ? Math.max(plan.start, out[pred].end - plan.overlap) : plan.start;
    if (step.done) {
      let end: number;
      if (!isYmd(step.done_date)) end = Math.min(plan.end, seq.unit === "day" ? now + 1 : now);
      else if (seq.unit === "day") end = dateEndOffset(s0, step.done_date);
      else {
        const planEndDate = spanDates(plan.start, plan.end, s0)!.to;
        end = step.done_date === planEndDate ? plan.end : dateEndOffset(s0, step.done_date);
      }
      out.push({ start: Math.min(start, end), end, changed: false });
      return;
    }
    const end = Math.max(start + duration, seq.unit === "day" ? now + 1 : now);
    const changed = Math.abs(start - plan.start) > 1e-9 || Math.abs(end - plan.end) > 1e-9;
    out.push({ start, end, changed });
  });
  return out;
}

export type ForecastSummary = {
  /** 계획 끝·예상 끝(순서표 시작부터) */
  planEnd: number;
  forecastEnd: number;
  /** 예상 − 계획: 일 단위는 일, 시간 단위는 시간 — 양수 = 늦음 */
  delay: number;
  /** 단계를 다 완료함(예상 = 실제 완료) */
  allDone: boolean;
  /** 예상(실제) 완료 글자 — 일: "11-06", 시간: "11-06 15:00" */
  endLabel: string;
  /** 정렬용 — 일: YYYY-MM-DD, 시간: "YYYY-MM-DD HH:MM" */
  endKey: string;
};

export function forecastSummary(
  forecast: ForecastStep[] | null,
  schedule: ScheduledStep[],
  seq: SequenceStart,
  steps: { done: boolean }[]
): ForecastSummary | null {
  if (!forecast || forecast.length === 0 || !isYmd(seq.start_date)) return null;
  const planEnd = totalSpan(schedule);
  const forecastEnd = forecast.reduce((max, f) => Math.max(max, f.end), 0);
  const allDone = steps.length > 0 && steps.every((s) => s.done);
  if (seq.unit === "day") {
    const lastDay = addDays(seq.start_date, Math.max(0, Math.ceil(forecastEnd) - 1));
    return { planEnd, forecastEnd, delay: Math.ceil(forecastEnd) - Math.ceil(planEnd), allDone, endLabel: md(lastDay), endKey: lastDay };
  }
  const at = addHours(seq.start_date, seq.start_time, forecastEnd);
  const delay = Math.round((forecastEnd - planEnd) * 60) / 60;
  return { planEnd, forecastEnd, delay, allDone, endLabel: `${md(at.date)} ${at.time}`, endKey: `${at.date} ${at.time}` };
}

/** "2일 늦음" · "계획대로" · "1일 빠름"(시간 단위는 시간, 30분 단위) */
export function delayLabel(delay: number, unit: SequenceUnit): string {
  const amount = (n: number) => (unit === "day" ? `${n}일` : `${formatHours(Math.round(n * 2) / 2)}시간`);
  if (unit === "hour" ? Math.abs(delay) < 0.25 : delay === 0) return "계획대로";
  return delay > 0 ? `${amount(delay)} 늦음` : `${amount(-delay)} 빠름`;
}

/** 목록용 짧은 글자 — "+2일" · "−1일" · "+1.5시간", 계획대로면 "" */
export function delayShort(delay: number, unit: SequenceUnit): string {
  if (unit === "hour" ? Math.abs(delay) < 0.25 : delay === 0) return "";
  const n = Math.abs(delay);
  return `${delay > 0 ? "+" : "−"}${unit === "day" ? `${n}일` : `${formatHours(Math.round(n * 2) / 2)}시간`}`;
}
