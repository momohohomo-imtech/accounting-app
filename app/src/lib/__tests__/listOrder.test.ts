import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byName,
  dailyWorkersOrder,
  activeEmployeesFirst,
  payrollOrder,
  toolChecklistDay,
  compareToolChecklistDay,
} from "@/lib/listOrder";

// 가짜 자료만
test("거래처·현장: 이름 가나다순, 같은 이름은 id 순", () => {
  const rows = [
    { id: "3", name: "다가짜" },
    { id: "2", name: "가가짜" },
    { id: "1", name: "가가짜" },
    { id: "4", name: null },
  ];
  assert.deepEqual(byName(rows).map((r) => r.id), ["4", "1", "2", "3"]);
  assert.deepEqual(rows.map((r) => r.id), ["3", "2", "1", "4"], "원래 배열은 그대로");
});

test("일용직: 근무중 먼저, 그다음 이름순", () => {
  const rows = [
    { id: "a", name: "나가짜", status: "ended" },
    { id: "b", name: "다가짜", status: "active" },
    { id: "c", name: "가가짜", status: "ended" },
    { id: "d", name: "라가짜", status: "active" },
  ];
  assert.deepEqual(dailyWorkersOrder(rows).map((r) => r.id), ["b", "d", "c", "a"]);
});

test("직원: 퇴사일이 지난 사람만 아래로, 그 안은 받은 순서(사원번호순) 그대로", () => {
  const rows = [
    { no: "1", resigned_date: "2026-01-31" },
    { no: "2", resigned_date: null },
    { no: "3", resigned_date: "2026-11-07" }, // 오늘 퇴사 = 오늘까지 재직
    { no: "4", resigned_date: "2026-12-31" }, // 퇴사 예정
    { no: "5", resigned_date: "2025-06-30" },
  ];
  assert.deepEqual(activeEmployeesFirst(rows, "2026-11-07").map((r) => r.no), ["2", "3", "4", "1", "5"]);
});

test("급여: 지급월 최신순, 같은 달은 사원번호순, 같은 사람은 먼저 등록한 것부터", () => {
  const rank = new Map([
    ["e1", 0],
    ["e2", 1],
  ]);
  const rows = [
    { id: "p1", pay_month: "2026-10-01", employee_id: "e2", created_at: "2026-10-25T00:00:00Z" },
    { id: "p2", pay_month: "2026-11-01", employee_id: "e2", created_at: "2026-11-25T00:00:00Z" },
    { id: "p3", pay_month: "2026-11-01", employee_id: "e1", created_at: "2026-11-26T00:00:00Z" },
    { id: "p4", pay_month: "2026-11-01", employee_id: "e1", created_at: "2026-11-20T00:00:00Z" },
    { id: "p5", pay_month: "2026-11-01", employee_id: "gone", created_at: "2026-11-01T00:00:00Z" },
  ];
  assert.deepEqual(payrollOrder(rows, rank).map((r) => r.id), ["p4", "p3", "p2", "p5", "p1"]);
});

test("공구명세서: 출장일 최신순, 출장일이 없으면 저장한 날(한국 날짜) 자리", () => {
  // 한국 시각 11/6 오전 1시에 저장 = UTC 11/5 16시 → 11/6 자리
  assert.equal(toolChecklistDay({ trip_date: null, created_at: "2026-11-05T16:00:00Z" }), "2026-11-06");
  assert.equal(toolChecklistDay({ trip_date: "2026-11-20", created_at: "2026-11-01T00:00:00Z" }), "2026-11-20");
  const rows = [
    { id: "a", trip_date: "2026-11-03", created_at: "2026-11-01T00:00:00Z" },
    { id: "b", trip_date: null, created_at: "2026-11-05T16:00:00Z" },
    { id: "c", trip_date: "2026-11-20", created_at: "2026-11-02T00:00:00Z" },
    { id: "d", trip_date: "2026-11-03", created_at: "2026-11-02T00:00:00Z" },
  ];
  assert.deepEqual([...rows].sort((x, y) => -compareToolChecklistDay(x, y)).map((r) => r.id), ["c", "b", "d", "a"]);
});
