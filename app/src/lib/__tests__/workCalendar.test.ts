import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarPrintTier,
  dayHeadcountLabel,
  monthRangeLabel,
  skippedMonthRanges,
  workCalendarDays,
  workCalendarMonths,
  workCalendarTotals,
  workDateRangeLabel,
} from "@/lib/workCalendar";
import { headcountForProjects, workDaySplitForProjects, type TripDayRow } from "@/lib/tripLog";

const trip = (project_id: string, work_date: string, staff: number, helper: number): TripDayRow => ({
  id: `${project_id}-${work_date}-${staff}-${helper}`,
  project_id,
  work_date,
  staff_count: staff,
  helper_count: helper,
  equipment_used: false,
  equipment_place: null,
  equipment_hours: null,
  note: null,
});

const logs = [
  { log_date: "2026-10-10", project_id: "pA" },
  { log_date: "2026-10-10", project_id: "pA" }, // 같은 날 두 줄 → 하루
  { log_date: "2026-10-11", project_id: "pA" },
  { log_date: "2026-10-12", project_id: "pB" }, // 귀속 하위
  { log_date: "2026-10-13", project_id: "pX" }, // 다른 프로젝트 — 빠짐
  { log_date: "2026-10-14", project_id: null },
];
const trips = [
  trip("pA", "2026-10-11", 2, 1), // 작업일지도 있는 날 → 출장
  trip("pB", "2026-10-11", 1, 0), // 같은 날 하위 프로젝트도 출장 → 인원 합
  trip("pB", "2026-11-03", 0, 3), // 작업일지 없이 출장만
  trip("pX", "2026-11-04", 5, 5), // 다른 프로젝트 — 빠짐
];

test("근무 달력: 날짜는 한 번만, 출장 체크한 날은 출장(같은 날 인원 합), 묶음 밖 프로젝트는 빠짐", () => {
  const days = workCalendarDays(logs, trips, ["pA", "pB"]);
  assert.deepEqual(days, [
    { date: "2026-10-10", kind: "inhouse", staff: 0, helper: 0 },
    { date: "2026-10-11", kind: "trip", staff: 3, helper: 1 },
    { date: "2026-10-12", kind: "inhouse", staff: 0, helper: 0 },
    { date: "2026-11-03", kind: "trip", staff: 0, helper: 3 },
  ]);
});

test("근무 달력: 보고서 근무일수·출장 투입 인원과 같은 숫자", () => {
  const ids = ["pA", "pB"];
  const t = workCalendarTotals(workCalendarDays(logs, trips, ids));
  const split = workDaySplitForProjects(logs, trips, ids);
  const head = headcountForProjects(trips, ids)!;
  assert.deepEqual({ inhouse: t.inhouse, trip: t.trip, total: t.total }, split);
  assert.deepEqual({ staff: t.staff, helper: t.helper }, { staff: head.staff, helper: head.helper });
});

test("근무 달력: 출장일지 표가 없으면(null) 모두 사내, 날짜에 시각이 붙어도 날짜만", () => {
  const days = workCalendarDays([{ log_date: "2026-10-10T00:00:00", project_id: "pA" }], null, ["pA"]);
  assert.deepEqual(days, [{ date: "2026-10-10", kind: "inhouse", staff: 0, helper: 0 }]);
  assert.deepEqual(workCalendarDays([], [], ["pA"]), []);
});

test("근무 달력: 작업한 달만(해를 넘겨도 이어서), 빠진 달 묶음 안내", () => {
  const days = [{ date: "2025-12-30" }, { date: "2026-01-05" }, { date: "2026-01-20" }, { date: "2026-04-02" }, { date: "2026-11-01" }];
  const months = workCalendarMonths(days);
  assert.deepEqual(months, [
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 4 },
    { year: 2026, month: 11 },
  ]);
  const gaps = skippedMonthRanges(months).map((g) => monthRangeLabel(g.from, g.to));
  assert.deepEqual(gaps, ["2026년 2~3월", "2026년 5~10월"]);
  assert.deepEqual(skippedMonthRanges([{ year: 2026, month: 10 }, { year: 2026, month: 11 }]), []);
  assert.equal(monthRangeLabel({ year: 2025, month: 12 }, { year: 2026, month: 2 }), "2025년 12월~2026년 2월");
  assert.equal(monthRangeLabel({ year: 2026, month: 3 }, { year: 2026, month: 3 }), "2026년 3월");
  assert.deepEqual(workCalendarMonths([]), []);
});

test("근무 달력: 기간 글자", () => {
  assert.equal(workDateRangeLabel([{ date: "2026-10-10" }, { date: "2026-11-12" }]), "2026.10.10 ~ 11.12");
  assert.equal(workDateRangeLabel([{ date: "2025-12-30" }, { date: "2026-01-05" }]), "2025.12.30 ~ 2026.1.5");
  assert.equal(workDateRangeLabel([{ date: "2026-10-10" }]), "2026.10.10");
  assert.equal(workDateRangeLabel([]), "-");
});

test("근무 달력: 출장일 인원 글자 — 0명인 쪽은 뺌", () => {
  assert.equal(dayHeadcountLabel({ staff: 2, helper: 1 }), "사2 조1");
  assert.equal(dayHeadcountLabel({ staff: 2, helper: 0 }), "사2");
  assert.equal(dayHeadcountLabel({ staff: 0, helper: 3 }), "조3");
  assert.equal(dayHeadcountLabel({ staff: 0, helper: 0 }), "");
});

test("근무 달력: 인쇄 크기 단계 — 달이 적을수록 크게", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 20].map(calendarPrintTier), [1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
});
