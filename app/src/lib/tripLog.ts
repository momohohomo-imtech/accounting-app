// 출장일지(새 방식, SQL 090) — 작업일지 팝업에서 "출장"을 체크한 날짜가 프로젝트별 출장일지 한 장에 모임.
// 날짜 줄(trip_log_days) ↔ 입력칸 값 변환과 맨 위 합계(총 일수·총 투입 인원), 보고서의 출장 투입 인원·작업일수 나눔.
import { resolveWorkLogTitles, type WorkLogTitleRow } from "@/lib/workLogSummary";

/** 출장일지 머리의 작업구분 선택지(예전 출장일지에서 쓰던 것 그대로). */
export const WORK_TYPE_OPTIONS = ["제작", "설치", "긴급", "기타"];

export type TripDayRow = {
  id: string;
  project_id: string;
  work_date: string;
  staff_count: number;
  helper_count: number;
  equipment_used: boolean;
  equipment_place: string | null;
  equipment_hours: string | null;
  note: string | null;
};

/** 작업일지 팝업·출장일지 수정 화면의 날짜 줄 입력값 — 인원 칸은 입력 중 빈 글자도 허용. */
export type TripDayInput = {
  staff: string;
  helper: string;
  equipmentUsed: boolean;
  place: string;
  hours: string;
  note: string;
};

export const EMPTY_TRIP_DAY_INPUT: TripDayInput = {
  staff: "",
  helper: "",
  equipmentUsed: false,
  place: "",
  hours: "",
  note: "",
};

export function tripDayToInput(d: Pick<TripDayRow, "staff_count" | "helper_count" | "equipment_used" | "equipment_place" | "equipment_hours" | "note">): TripDayInput {
  return {
    staff: d.staff_count ? String(d.staff_count) : "",
    helper: d.helper_count ? String(d.helper_count) : "",
    equipmentUsed: d.equipment_used,
    place: d.equipment_place ?? "",
    hours: d.equipment_hours ?? "",
    note: d.note ?? "",
  };
}

/** 인원 칸 글자 → 0 이상의 정수(빈칸·글자·음수는 0, 소수는 버림). */
export function parseCount(value: string | number | null | undefined): number {
  const n = Math.floor(Number(String(value ?? "").trim()));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 입력값 → 저장할 칸. 장비를 안 썼으면 사용처·시간은 비움(비고는 날짜 비고라 그대로). */
export function inputToTripDayFields(input: TripDayInput) {
  const text = (v: string) => v.trim() || null;
  return {
    staff_count: parseCount(input.staff),
    helper_count: parseCount(input.helper),
    equipment_used: input.equipmentUsed,
    equipment_place: input.equipmentUsed ? text(input.place) : null,
    equipment_hours: input.equipmentUsed ? text(input.hours) : null,
    note: text(input.note),
  };
}

export type Headcount = {
  staff: number;
  helper: number;
  /** 총 투입 인원(연인원) = 날짜별 사내 + 조공의 합 */
  people: number;
};

/** 날짜 줄들의 사내·조공 인원 합(연인원). 출장일지 맨 위 합계와 보고서(프로젝트 요약·프로젝트 보고서)의 출장 투입 인원이 같이 씀. */
export function sumHeadcount(days: Pick<TripDayRow, "staff_count" | "helper_count">[]): Headcount {
  const staff = days.reduce((s, d) => s + parseCount(d.staff_count), 0);
  const helper = days.reduce((s, d) => s + parseCount(d.helper_count), 0);
  return { staff, helper, people: staff + helper };
}

/**
 * 보고서의 출장 투입 인원 — 프로젝트(+귀속 하위 프로젝트) 묶음의 출장 날짜 줄을 합산. 인원을 적은 날(출장 체크한 날)이
 * 하나도 없거나 출장일지 표(090)가 없어서 days가 null이면 null.
 */
export function headcountForProjects(
  days: Pick<TripDayRow, "project_id" | "staff_count" | "helper_count">[] | null,
  projectIds: Iterable<string>
): Headcount | null {
  if (!days) return null;
  const ids = new Set(projectIds);
  const mine = days.filter((d) => ids.has(d.project_id));
  return mine.length ? sumHeadcount(mine) : null;
}

/** 보고서 표시용 조각 — ["사내 3명", "조공 2명", "총 5명"]. 휴대폰에서 "사내 / 3명"처럼 끊기지 않게 조각별로 묶으려고 나눔. */
export function headcountParts(h: Headcount): string[] {
  return [`사내 ${h.staff}명`, `조공 ${h.helper}명`, `총 ${h.people}명`];
}

/** 보고서 표시용 — "사내 3명, 조공 2명, 총 5명". 인원을 적은 날이 없으면(null) "-". */
export function formatHeadcount(h: Headcount | null): string {
  return h ? headcountParts(h).join(", ") : "-";
}

export type WorkDaySplit = {
  /** 작업일지에만 있고 출장으로 체크하지 않은 날 */
  inhouse: number;
  /** 출장으로 체크한 날 */
  trip: number;
  /** 사내 + 출장(날짜는 한 번만) */
  total: number;
};

/**
 * 작업일수 나눔 — 작업일지 날짜 중 출장 날짜는 출장, 나머지는 사내(출장일지 팝업에선 "내근"). 날짜는 한 번만 세서
 * 사내 + 출장 = 총. 작업일지 줄 없이 출장 날짜만 있는 날도 출장으로 셈.
 */
export function workDaySplit(workDates: Iterable<string>, tripDates: Iterable<string>): WorkDaySplit {
  const trip = new Set(tripDates);
  const all = new Set(workDates);
  for (const d of trip) all.add(d);
  return { inhouse: all.size - trip.size, trip: trip.size, total: all.size };
}

/**
 * 보고서의 작업일수 나눔 — 프로젝트(+귀속 하위 프로젝트) 묶음이 작업일지에 있는 날짜 중 출장으로 체크한 날은 출장,
 * 나머지는 사내. 날짜는 한 번만 세서 사내 + 출장 = 총(같은 날 묶음 안의 한 프로젝트라도 출장이면 그날은 출장).
 * 출장 날짜 줄만 있고 작업일지 줄이 없는 날도 출장으로 셈. 출장일지 표(090)가 없으면(tripDays null) 출장 0일.
 */
export function workDaySplitForProjects(
  workLogs: { log_date: string; project_id: string | null }[],
  tripDays: Pick<TripDayRow, "project_id" | "work_date">[] | null,
  projectIds: Iterable<string>
): WorkDaySplit {
  const ids = new Set(projectIds);
  return workDaySplit(
    workLogs.filter((r) => r.project_id && ids.has(r.project_id)).map((r) => r.log_date),
    (tripDays ?? []).filter((d) => ids.has(d.project_id)).map((d) => d.work_date)
  );
}

/** 보고서 표시용 조각 — ["사내 3일", "출장 2일", "총 5일"]. */
export function workDayParts(w: WorkDaySplit): string[] {
  return [`사내 ${w.inhouse}일`, `출장 ${w.trip}일`, `총 ${w.total}일`];
}

/** 보고서 표시용 — "사내 3일, 출장 2일, 총 5일". */
export function formatWorkDays(w: WorkDaySplit): string {
  return workDayParts(w).join(", ");
}

export type TripTotals = Headcount & {
  /** 출장 날짜 수 */
  days: number;
  /** 장비를 투입한 날짜 수 */
  equipmentDays: number;
  from: string | null;
  to: string | null;
};

export function tripTotals(
  days: Pick<TripDayRow, "work_date" | "staff_count" | "helper_count" | "equipment_used">[]
): TripTotals {
  const dates = new Set(days.map((d) => d.work_date));
  const equipmentDates = new Set(days.filter((d) => d.equipment_used).map((d) => d.work_date));
  const sorted = Array.from(dates).sort();
  return {
    days: dates.size,
    ...sumHeadcount(days),
    equipmentDays: equipmentDates.size,
    from: sorted[0] ?? null,
    to: sorted[sorted.length - 1] ?? null,
  };
}

/** 출장일지 기간 — "2026-09-01 ~ 2026-09-14"(하루면 그 날짜만), 날짜가 없으면 공란. */
export function formatTripPeriod(t: Pick<TripTotals, "from" | "to">): string {
  if (!t.from) return "";
  return !t.to || t.from === t.to ? t.from : `${t.from} ~ ${t.to}`;
}

/** 출장일지 숫자 칸 — 0(인원을 안 적은 날·장비 없음 등)은 "0명"·"-" 대신 공란(사용자 요청). */
export function countLabel(n: number, unit = ""): string {
  return n > 0 ? `${n}${unit}` : "";
}

/** 출장일지 한 장(프로젝트 하나) — 원청사·현장은 프로젝트에서, 작업구분·비고는 trip_logs에서. */
export type TripProjectDoc = {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  siteName: string | null;
  clientName: string | null;
  workTypes: string[];
  note: string;
  /** 날짜순. contents = 그날 그 프로젝트 작업일지 내용(작업 집계와 같은 이어받기 규칙). */
  days: (TripDayRow & { contents: string })[];
  /** 목록 조회 기간(연·월 필터) 안에 이 프로젝트가 작업일지에 있는 날짜(중복 없이) — 내근 일수 = 이 중 출장 아닌 날. */
  workDates: string[];
  /** 목록 조회 기간 이름("2026년", "2026년 9월") — 내근 일수가 어느 기간 기준인지 표시. */
  periodLabel: string;
};

export function tripProjectLabel(doc: Pick<TripProjectDoc, "projectCode" | "projectName">) {
  return doc.projectCode ? `${doc.projectCode} ${doc.projectName}` : doc.projectName;
}

/** 목록의 "최근 작업 내용" — 내용이 있는 가장 늦은 출장 날짜의 작업 내용. 없으면 공란. */
export function latestTripContents(days: Pick<TripProjectDoc["days"][number], "work_date" | "contents">[]): string {
  let latest: { date: string; contents: string } | null = null;
  for (const d of days) {
    const contents = d.contents.trim();
    if (contents && (!latest || d.work_date > latest.date)) latest = { date: d.work_date, contents };
  }
  return latest?.contents ?? "";
}

/**
 * 프로젝트·날짜별 작업 내용(출장 날짜 줄 옆에 보여줄 것) — 작업 집계와 같은 이어받기(resolveWorkLogTitles)를 해마다 그 해
 * 1월 1일부터 정함(연도를 넘겨 이어받지 않음 — 출장일지 탭·보고서·프로젝트 보고서가 같은 글자). 같은 날 같은 프로젝트 줄이
 * 여럿이면 " / "로 이어 붙임. 키는 `${project_id}|${log_date}`.
 */
export function workLogContentsByProjectDate(rows: WorkLogTitleRow[]): Map<string, string> {
  const byYear = new Map<string, WorkLogTitleRow[]>();
  for (const r of rows) {
    const year = r.log_date.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), r]);
  }
  const lists = new Map<string, string[]>();
  for (const yearRows of byYear.values()) {
    for (const { row, title } of resolveWorkLogTitles(yearRows)) {
      if (!title || !row.project_id) continue;
      const key = `${row.project_id}|${row.log_date}`;
      const list = lists.get(key) ?? [];
      if (!list.includes(title)) list.push(title);
      lists.set(key, list);
    }
  }
  return new Map(Array.from(lists, ([key, list]) => [key, list.join(" / ")]));
}
