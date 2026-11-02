// 공사 작업 순서 일정 계산(사용자 결정 11/2: "기간 + 앞 작업과 겹침 → 날짜 자동", 단위는 순서표마다 일 또는 시간, 토·일 포함
// 달력 그대로 — 검사: workSequence.test.ts). 날짜는 저장하지 않고 늘 여기서 계산해서, 순번을 바꾸거나 기간·겹침을 고치면 날짜가
// 저절로 다시 맞춰짐(098 SQL).
//  - 1번 단계는 순서표 시작에 시작
//  - n번 단계 시작 = 앞 단계 끝 − 겹침(겹침 0 = 앞 단계가 끝난 다음에 시작). 겹침은 앞 단계 기간까지만 — 더 크면 앞 단계보다 먼저
//    시작하게 돼서 앞 단계 기간으로 줄여 계산하고 화면에 알림(overlapClamped)
//  - 일 단위: 단계는 시작일부터 기간만큼의 날(끝날 포함) — 11-10 시작 3일 작업은 11-10~11-12
//  - 시간 단위: 시작 시각부터 기간만큼 쉬지 않고 이어서 — 08:00 시작 3시간 작업은 08:00~11:00(자정을 넘으면 날짜도 바뀜)

export type SequenceUnit = "day" | "hour";
export const UNIT_LABEL: Record<SequenceUnit, string> = { day: "일", hour: "시간" };

export type StepInput = { duration: number; overlap: number };
export type ScheduledStep = {
  /** 순서표 시작부터(일 또는 시간) */
  start: number;
  end: number;
  /** 실제로 적용한 겹침(앞 단계 기간까지만) */
  overlap: number;
  /** 적은 겹침이 앞 단계 기간보다 커서 줄였음 */
  overlapClamped: boolean;
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
    if (i === 0) {
      out.push({ start: 0, end: duration, overlap: 0, overlapClamped: false });
      return;
    }
    const prev = out[i - 1];
    const prevDuration = prev.end - prev.start;
    const wanted = Math.max(0, Number(s.overlap) || 0);
    const overlap = Math.min(wanted, prevDuration);
    const start = prev.end - overlap;
    out.push({ start, end: start + duration, overlap, overlapClamped: wanted > prevDuration });
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
  return stepRangeLabel({ start: 0, end: totalSpan(schedule), overlap: 0, overlapClamped: false }, seq);
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
