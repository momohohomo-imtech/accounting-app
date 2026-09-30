import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_TRIP_DAY_INPUT,
  formatHeadcount,
  formatWorkDays,
  headcountForProjects,
  headcountParts,
  inputToTripDayFields,
  parseCount,
  sumHeadcount,
  tripDayToInput,
  tripTotals,
  workDayParts,
  workDaySplitForProjects,
} from "@/lib/tripLog";

test("인원 칸: 빈칸·글자·음수는 0, 소수는 버림", () => {
  assert.equal(parseCount("3"), 3);
  assert.equal(parseCount(" 2 "), 2);
  assert.equal(parseCount(""), 0);
  assert.equal(parseCount("두명"), 0);
  assert.equal(parseCount("-1"), 0);
  assert.equal(parseCount("2.7"), 2);
  assert.equal(parseCount(null), 0);
  assert.equal(parseCount(4), 4);
});

test("입력값 → 저장 칸: 장비를 안 쓰면 사용처·시간은 비우고 비고는 남김", () => {
  assert.deepEqual(
    inputToTripDayFields({ staff: "2", helper: "1", equipmentUsed: false, place: "B동", hours: "4시간", note: "야간" }),
    { staff_count: 2, helper_count: 1, equipment_used: false, equipment_place: null, equipment_hours: null, note: "야간" }
  );
  assert.deepEqual(
    inputToTripDayFields({ ...EMPTY_TRIP_DAY_INPUT, equipmentUsed: true, place: " 2층 천장 ", hours: "09~13시" }),
    { staff_count: 0, helper_count: 0, equipment_used: true, equipment_place: "2층 천장", equipment_hours: "09~13시", note: null }
  );
});

test("저장된 줄 → 입력값(0명은 빈칸으로)", () => {
  assert.deepEqual(
    tripDayToInput({ staff_count: 3, helper_count: 0, equipment_used: true, equipment_place: "라인 상부", equipment_hours: null, note: null }),
    { staff: "3", helper: "", equipmentUsed: true, place: "라인 상부", hours: "", note: "" }
  );
});

test("합계: 총 일수·사내·조공·총 투입 인원(연인원)·장비 투입 일수·기간", () => {
  const t = tripTotals([
    { work_date: "2026-09-16", staff_count: 2, helper_count: 1, equipment_used: false },
    { work_date: "2026-09-18", staff_count: 3, helper_count: 2, equipment_used: true },
    { work_date: "2026-09-17", staff_count: 2, helper_count: 0, equipment_used: true },
  ]);
  assert.deepEqual(t, { days: 3, staff: 7, helper: 3, people: 10, equipmentDays: 2, from: "2026-09-16", to: "2026-09-18" });
  assert.deepEqual(tripTotals([]), { days: 0, staff: 0, helper: 0, people: 0, equipmentDays: 0, from: null, to: null });
});

test("투입 인원 합: 사내·조공·총(연인원), 잘못 들어간 값은 0", () => {
  assert.deepEqual(
    sumHeadcount([
      { staff_count: 2, helper_count: 1 },
      { staff_count: 3, helper_count: 0 },
      { staff_count: -1, helper_count: 2 },
    ]),
    { staff: 5, helper: 3, people: 8 }
  );
  assert.deepEqual(sumHeadcount([]), { staff: 0, helper: 0, people: 0 });
});

test("보고서 투입 인원: 프로젝트 묶음(귀속 하위 포함)만 합산, 적은 날이 없거나 표가 없으면 null", () => {
  const days = [
    { project_id: "p-parent", staff_count: 2, helper_count: 1 },
    { project_id: "p-child", staff_count: 1, helper_count: 1 },
    { project_id: "p-other", staff_count: 4, helper_count: 4 },
    { project_id: "p-zero", staff_count: 0, helper_count: 0 },
  ];
  assert.deepEqual(headcountForProjects(days, ["p-parent", "p-child"]), { staff: 3, helper: 2, people: 5 });
  assert.deepEqual(headcountForProjects(days, new Set(["p-other"])), { staff: 4, helper: 4, people: 8 });
  // 출장 체크는 했는데 인원을 안 적은 날뿐이면 0명(적은 기록은 있음)
  assert.deepEqual(headcountForProjects(days, ["p-zero"]), { staff: 0, helper: 0, people: 0 });
  assert.equal(headcountForProjects(days, ["p-none"]), null);
  assert.equal(headcountForProjects(null, ["p-parent"]), null);
});

test("투입 인원 표시: \"사내 N명, 조공 N명, 총 N명\", 없으면 \"-\"", () => {
  assert.equal(formatHeadcount({ staff: 12, helper: 5, people: 17 }), "사내 12명, 조공 5명, 총 17명");
  assert.equal(formatHeadcount({ staff: 0, helper: 0, people: 0 }), "사내 0명, 조공 0명, 총 0명");
  assert.equal(formatHeadcount(null), "-");
  assert.deepEqual(headcountParts({ staff: 3, helper: 0, people: 3 }), ["사내 3명", "조공 0명", "총 3명"]);
});

test("작업일수 나눔: 출장 체크한 날은 출장, 나머지 작업일지 날짜는 사내, 날짜는 한 번만(사내 + 출장 = 총)", () => {
  const logs = [
    { log_date: "2026-09-01", project_id: "p-parent" },
    { log_date: "2026-09-01", project_id: "p-parent" }, // 같은 날 두 줄
    { log_date: "2026-09-02", project_id: "p-parent" },
    { log_date: "2026-09-03", project_id: "p-child" },
    { log_date: "2026-09-04", project_id: "p-child" },
    { log_date: "2026-09-05", project_id: "p-other" },
    { log_date: "2026-09-06", project_id: null },
  ];
  const trips = [
    { project_id: "p-parent", work_date: "2026-09-02" },
    // 같은 날 하위 프로젝트만 출장이어도 그날은 출장(묶음 기준)
    { project_id: "p-child", work_date: "2026-09-01" },
    // 작업일지 줄 없이 출장 줄만 있는 날도 출장으로 셈
    { project_id: "p-child", work_date: "2026-09-07" },
    { project_id: "p-other", work_date: "2026-09-05" },
  ];
  assert.deepEqual(workDaySplitForProjects(logs, trips, ["p-parent", "p-child"]), { inhouse: 2, trip: 3, total: 5 });
  assert.deepEqual(workDaySplitForProjects(logs, trips, new Set(["p-other"])), { inhouse: 0, trip: 1, total: 1 });
  // 출장일지 표가 없으면 출장 0일, 전부 사내
  assert.deepEqual(workDaySplitForProjects(logs, null, ["p-parent"]), { inhouse: 2, trip: 0, total: 2 });
  assert.deepEqual(workDaySplitForProjects([], [], ["p-none"]), { inhouse: 0, trip: 0, total: 0 });
});

test("작업일수 표시: \"사내 N일, 출장 N일, 총 N일\"", () => {
  assert.equal(formatWorkDays({ inhouse: 3, trip: 2, total: 5 }), "사내 3일, 출장 2일, 총 5일");
  assert.deepEqual(workDayParts({ inhouse: 0, trip: 1, total: 1 }), ["사내 0일", "출장 1일", "총 1일"]);
});
