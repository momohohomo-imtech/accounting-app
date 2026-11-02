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
  const whole = { start: 0, end: totalSpan(schedule), overlap: 0, overlapClamped: false, predecessor: null, afterInvalid: false };
  return stepRangeLabel(whole, seq);
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
