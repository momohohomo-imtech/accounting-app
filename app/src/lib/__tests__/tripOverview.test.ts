import { test } from "node:test";
import assert from "node:assert/strict";
import type { TripProjectDoc } from "@/lib/tripLog";
import {
  calendarLevel,
  docsForMonth,
  tripCalendarDays,
  tripGroupRows,
  tripMonthlyRows,
  tripOverviewTotals,
  tripProjectRows,
} from "@/lib/tripOverview";

// 가짜 문서 — 이름·숫자는 지어낸 것
function doc(
  id: string,
  client: string | null,
  site: string | null,
  days: [string, number, number, boolean?, string?][],
  workDates: string[] = []
): TripProjectDoc {
  return {
    projectId: id,
    projectName: `가짜 프로젝트 ${id}`,
    projectCode: null,
    siteName: site,
    clientName: client,
    workTypes: [],
    note: "",
    days: days.map(([work_date, staff, helper, equip = false, contents = ""], i) => ({
      id: `${id}-${i}`,
      project_id: id,
      work_date,
      staff_count: staff,
      helper_count: helper,
      equipment_used: equip,
      equipment_place: null,
      equipment_hours: null,
      note: null,
      contents,
    })),
    workDates,
    periodLabel: "2026년",
  };
}

const docs = [
  doc("a", "가나산업", "A현장", [["2026-08-03", 2, 1, true, "반입"], ["2026-09-14", 3, 2, false, "설치"]], ["2026-08-01", "2026-08-03", "2026-09-14"]),
  doc("b", "가나산업", "B현장", [["2026-09-14", 1, 0], ["2026-09-15", 2, 2, true]]),
  doc("c", null, "A현장", [["2026-06-10", 0, 0]]),
];

test("출장 현황 합계: 같은 날 여러 프로젝트는 하루, 인원은 연인원, 장비는 날짜 수", () => {
  assert.deepEqual(tripOverviewTotals(docs), {
    tripDays: 4, // 06-10, 08-03, 09-14(두 프로젝트), 09-15
    projects: 3,
    staff: 8,
    helper: 5,
    people: 13,
    equipmentDays: 2,
  });
  assert.deepEqual(tripOverviewTotals([]), { tripDays: 0, projects: 0, staff: 0, helper: 0, people: 0, equipmentDays: 0 });
});

test("월 고르기: 그 달 날짜 줄·작업일지 날짜만, 그 달 출장 없는 프로젝트는 빠짐", () => {
  const sep = docsForMonth(docs, 2026, 9);
  assert.deepEqual(sep.map((d) => d.projectId), ["a", "b"]);
  assert.deepEqual(sep[0].days.map((d) => d.work_date), ["2026-09-14"]);
  assert.deepEqual(sep[0].workDates, ["2026-09-14"]);
  assert.equal(sep[0].periodLabel, "2026년 9월");
  assert.equal(docsForMonth(docs, 2026, null), docs);
});

test("월별 줄: 12달 모두, 출장 없는 달은 0", () => {
  const rows = tripMonthlyRows(docs);
  assert.equal(rows.length, 12);
  assert.deepEqual(
    rows.filter((r) => r.tripDays > 0).map((r) => [r.month, r.tripDays, r.people, r.projects]),
    [
      [6, 1, 0, 1],
      [8, 1, 3, 1],
      [9, 2, 10, 2],
    ]
  );
  assert.equal(rows[0].tripDays, 0);
});

test("달력: 날짜별 인원 합·프로젝트, 진하기는 가장 많은 날 대비", () => {
  const cal = tripCalendarDays(docs);
  assert.deepEqual(cal.get("2026-09-14"), {
    people: 6,
    projects: [
      { label: "가짜 프로젝트 a", people: 5 },
      { label: "가짜 프로젝트 b", people: 1 },
    ],
  });
  assert.equal(calendarLevel(0, 6, false), 0);
  assert.equal(calendarLevel(0, 6, true), 1); // 출장은 했는데 인원 안 적음
  assert.equal(calendarLevel(2, 6, true), 2);
  assert.equal(calendarLevel(4, 6, true), 3);
  assert.equal(calendarLevel(6, 6, true), 4);
});

test("프로젝트별 줄: 합계·내근 일수·최근 작업 내용", () => {
  const [a] = tripProjectRows(docs);
  assert.equal(a.totals.days, 2);
  assert.equal(a.totals.people, 8);
  assert.equal(a.inhouse, 1); // 작업일지 08-01만 출장 아님
  assert.equal(a.latest, "설치");
});

test("원청사별·현장별 줄: 묶음 안에서 날짜는 한 번만, 이름 없으면 미지정", () => {
  const byClient = tripGroupRows(docs, "client");
  assert.deepEqual(
    byClient.map((r) => [r.name, r.projects, r.tripDays, r.people, r.from, r.to]),
    [
      ["가나산업", 2, 3, 13, "2026-08-03", "2026-09-15"],
      ["미지정", 1, 1, 0, "2026-06-10", "2026-06-10"],
    ]
  );
  const bySite = tripGroupRows(docs, "site");
  assert.deepEqual(
    bySite.map((r) => [r.name, r.projects, r.tripDays]),
    [
      ["A현장", 2, 3],
      ["B현장", 1, 2],
    ]
  );
});
