// 프로젝트 보고서 "근무 달력"(사용자 요청 11/22 — 근무일수 옆 달력 버튼: 사내 근무 노랑·출장 빨강 동그라미, 출장일 아래 그날 투입
// 인원(사내·조공), 작업한 달만 크게, A4 한 장 인쇄. 검사: workCalendar.test.ts). 날짜는 보고서 "근무일수"(lib/tripLog.ts의
// workDaySplitForProjects)와 같은 기준 — 작업일지 날짜 중 출장으로 체크한 날은 출장, 나머지는 사내, 같은 날은 하루, 귀속 하위
// 프로젝트 포함(같은 날 묶음 안의 한 프로젝트라도 출장이면 그날은 출장). 작업일지 줄 없이 출장 날짜만 있는 날도 출장.
import { parseCount, type TripDayRow } from "@/lib/tripLog";

export type WorkCalendarDay = {
  /** YYYY-MM-DD */
  date: string;
  kind: "inhouse" | "trip";
  /** 출장일에 적은 사내 인원(같은 날 묶음 안 프로젝트 합) — 사내 근무일은 0 */
  staff: number;
  /** 출장일에 적은 조공 인원 */
  helper: number;
};

const dateKey = (v: string) => String(v).slice(0, 10);

/** 달력에 칠할 날짜들(날짜 순) — 근무일수와 같은 기준. tripDays가 null이면(출장일지 표 090 전) 모두 사내. */
export function workCalendarDays(
  workLogs: { log_date: string; project_id: string | null }[],
  tripDays: Pick<TripDayRow, "project_id" | "work_date" | "staff_count" | "helper_count">[] | null,
  projectIds: Iterable<string>
): WorkCalendarDay[] {
  const ids = new Set(projectIds);
  const trip = new Map<string, { staff: number; helper: number }>();
  for (const d of tripDays ?? []) {
    if (!ids.has(d.project_id)) continue;
    const key = dateKey(d.work_date);
    const cur = trip.get(key) ?? { staff: 0, helper: 0 };
    cur.staff += parseCount(d.staff_count);
    cur.helper += parseCount(d.helper_count);
    trip.set(key, cur);
  }
  const dates = new Set(trip.keys());
  for (const r of workLogs) if (r.project_id && ids.has(r.project_id)) dates.add(dateKey(r.log_date));
  return [...dates].sort().map((date) => {
    const t = trip.get(date);
    return t ? { date, kind: "trip", staff: t.staff, helper: t.helper } : { date, kind: "inhouse", staff: 0, helper: 0 };
  });
}

export type WorkCalendarTotals = { inhouse: number; trip: number; total: number; staff: number; helper: number };

/** 달력 위 요약 — 사내·출장·총 근무일, 출장 투입 인원(연인원) 합 */
export function workCalendarTotals(days: WorkCalendarDay[]): WorkCalendarTotals {
  const trip = days.filter((d) => d.kind === "trip");
  return {
    inhouse: days.length - trip.length,
    trip: trip.length,
    total: days.length,
    staff: trip.reduce((s, d) => s + d.staff, 0),
    helper: trip.reduce((s, d) => s + d.helper, 0),
  };
}

export type CalendarMonthKey = { year: number; month: number };

const monthIndex = (m: CalendarMonthKey) => m.year * 12 + (m.month - 1);
const fromIndex = (i: number): CalendarMonthKey => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });

/** 작업한 날이 있는 달만(시간 순, 해를 넘겨도 이어서) — 작업 없는 달은 빼서 달이 적을수록 크게 보이게(사용자 요청 11/22). */
export function workCalendarMonths(days: Pick<WorkCalendarDay, "date">[]): CalendarMonthKey[] {
  const set = new Set<number>();
  for (const d of days) {
    const [y, m] = d.date.split("-").map(Number);
    if (y && m) set.add(y * 12 + (m - 1));
  }
  return [...set].sort((a, b) => a - b).map(fromIndex);
}

/** 보여 주는 달 사이에 빠진(작업 없는) 달 묶음 — "2026년 3~9월 작업 없음" 안내용 */
export function skippedMonthRanges(months: CalendarMonthKey[]): { from: CalendarMonthKey; to: CalendarMonthKey }[] {
  const out: { from: CalendarMonthKey; to: CalendarMonthKey }[] = [];
  for (let i = 1; i < months.length; i++) {
    const prev = monthIndex(months[i - 1]);
    const cur = monthIndex(months[i]);
    if (cur - prev > 1) out.push({ from: fromIndex(prev + 1), to: fromIndex(cur - 1) });
  }
  return out;
}

/** "2026년 3월" · "2026년 3~9월" · "2025년 12월~2026년 2월" */
export function monthRangeLabel(from: CalendarMonthKey, to: CalendarMonthKey): string {
  if (from.year === to.year && from.month === to.month) return `${from.year}년 ${from.month}월`;
  if (from.year === to.year) return `${from.year}년 ${from.month}~${to.month}월`;
  return `${from.year}년 ${from.month}월~${to.year}년 ${to.month}월`;
}

/** 첫 근무일 ~ 마지막 근무일 — "2026.10.10 ~ 11.12"(해가 같으면 뒤쪽 연도 생략), 하루면 그날만. 날짜가 없으면 "-". */
export function workDateRangeLabel(days: Pick<WorkCalendarDay, "date">[]): string {
  if (days.length === 0) return "-";
  const fmt = (d: string, withYear: boolean) => {
    const [y, m, dd] = d.split("-");
    return withYear ? `${y}.${Number(m)}.${Number(dd)}` : `${Number(m)}.${Number(dd)}`;
  };
  const first = days[0].date;
  const last = days[days.length - 1].date;
  if (first === last) return fmt(first, true);
  return `${fmt(first, true)} ~ ${fmt(last, first.slice(0, 4) !== last.slice(0, 4))}`;
}

/** 출장일 아래 투입 인원 — "사2 조1"(0명인 쪽은 뺌, 둘 다 0이면 빈 글자). 사용자 결정 11/22: "인력"이 아니라 앱 이름대로 "조공". */
export function dayHeadcountLabel(d: Pick<WorkCalendarDay, "staff" | "helper">): string {
  return [d.staff > 0 ? `사${d.staff}` : "", d.helper > 0 ? `조${d.helper}` : ""].filter(Boolean).join(" ");
}

/**
 * 인쇄(A4 세로 한 장) 크기 단계 — 달이 적을수록 크게(사용자 요청 11/22 "글씨도 작아질 텐데"). 칸 크기는 6주짜리 달이 줄마다 와도
 * 한 장에 들어가게 정함(components/WorkCalendarButton.tsx의 PRINT_SIZE): 1달 · 2달(한 줄 1개) · 3~4달 · 5~6달(한 줄 2개) ·
 * 7~9달 · 10~12달(한 줄 3개) · 13달부터(한 줄 4개 — 16달까지 한 장, 그보다 길면 다음 장으로 이어짐).
 */
export function calendarPrintTier(monthCount: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (monthCount <= 1) return 1;
  if (monthCount === 2) return 2;
  if (monthCount <= 4) return 3;
  if (monthCount <= 6) return 4;
  if (monthCount <= 9) return 5;
  if (monthCount <= 12) return 6;
  return 7;
}
