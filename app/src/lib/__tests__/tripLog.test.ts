import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_TRIP_DAY_INPUT, inputToTripDayFields, parseCount, tripDayToInput, tripTotals } from "@/lib/tripLog";

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
