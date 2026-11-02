import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addHours,
  chartColumns,
  formatAmount,
  normalizeAmount,
  scheduleSteps,
  sequenceRangeLabel,
  stepRangeLabel,
  totalSpan,
  weekdayOf,
} from "@/lib/workSequence";

test("작업 순서: 시작 = 앞 단계 끝 − 겹침(겹침 0이면 앞 단계가 끝난 다음)", () => {
  const schedule = scheduleSteps([
    { duration: 1, overlap: 0 },
    { duration: 2, overlap: 0 },
    { duration: 3, overlap: 1 },
    { duration: 2, overlap: 1 },
  ]);
  assert.deepEqual(
    schedule.map((s) => [s.start, s.end, s.overlap]),
    [
      [0, 1, 0],
      [1, 3, 0],
      [2, 5, 1],
      [4, 6, 1],
    ]
  );
  assert.equal(totalSpan(schedule), 6);
});

test("작업 순서: 1번 단계 겹침은 무시, 앞 단계 기간보다 큰 겹침은 앞 단계 기간까지만(알림 표시)", () => {
  const schedule = scheduleSteps([
    { duration: 2, overlap: 5 },
    { duration: 1, overlap: 3 },
  ]);
  assert.deepEqual(schedule[0], { start: 0, end: 2, overlap: 0, overlapClamped: false });
  assert.deepEqual(schedule[1], { start: 0, end: 1, overlap: 2, overlapClamped: true });
  // 겹침 때문에 마지막 단계가 먼저 끝나도 전체 기간은 가장 늦게 끝나는 단계 기준
  assert.equal(totalSpan(schedule), 2);
  assert.deepEqual(scheduleSteps([]), []);
});

test("작업 순서: 순번을 바꾸면 날짜도 다시 계산(같은 단계라도 자리에 따라 시작이 달라짐)", () => {
  const a = { duration: 3, overlap: 0 };
  const b = { duration: 1, overlap: 1 };
  assert.deepEqual(scheduleSteps([a, b]).map((s) => s.start), [0, 2]);
  assert.deepEqual(scheduleSteps([b, a]).map((s) => s.start), [0, 1]);
});

test("작업 순서: 입력값 정리 — 일은 정수(최소 1), 시간은 0.5 단위(최소 0.5), 겹침은 0 이상", () => {
  assert.equal(normalizeAmount(2.6, "day", "duration"), 3);
  assert.equal(normalizeAmount(0, "day", "duration"), 1);
  assert.equal(normalizeAmount(1.3, "hour", "duration"), 1.5);
  assert.equal(normalizeAmount(0.1, "hour", "duration"), 0.5);
  assert.equal(normalizeAmount(-2, "day", "overlap"), 0);
  assert.equal(normalizeAmount(Number.NaN, "hour", "overlap"), 0);
  assert.equal(formatAmount(3, "day"), "3일");
  assert.equal(formatAmount(1.5, "hour"), "1.5시간");
});

test("작업 순서: 일 단위 날짜 — 토·일 포함 달력 그대로, 끝날 포함", () => {
  assert.equal(addDays("2026-11-27", 3), "2026-11-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(weekdayOf("2026-11-01"), "일");
  const seq = { unit: "day" as const, start_date: "2026-11-10", start_time: null };
  const [s1, s2, s3] = scheduleSteps([
    { duration: 1, overlap: 0 },
    { duration: 2, overlap: 0 },
    { duration: 3, overlap: 1 },
  ]);
  assert.equal(stepRangeLabel(s1, seq), "11-10");
  assert.equal(stepRangeLabel(s2, seq), "11-11~11-12");
  assert.equal(stepRangeLabel(s3, seq), "11-12~11-14");
  assert.equal(sequenceRangeLabel([s1, s2, s3], seq), "11-10~11-14");
  // 금요일 시작 3일 작업은 일요일에 끝남(주말 포함)
  assert.equal(stepRangeLabel(scheduleSteps([{ duration: 3, overlap: 0 }])[0], { ...seq, start_date: "2026-11-13" }), "11-13~11-15");
});

test("작업 순서: 시간 단위 — 시작 시각부터 이어서, 자정을 넘으면 날짜도", () => {
  assert.deepEqual(addHours("2026-11-10", "08:00", 3.5), { date: "2026-11-10", time: "11:30" });
  assert.deepEqual(addHours("2026-11-10", "22:00", 4), { date: "2026-11-11", time: "02:00" });
  assert.deepEqual(addHours("2026-11-10", null, 1), { date: "2026-11-10", time: "01:00" });
  const seq = { unit: "hour" as const, start_date: "2026-11-10", start_time: "08:00" };
  const [s1, s2] = scheduleSteps([
    { duration: 3, overlap: 0 },
    { duration: 2, overlap: 0.5 },
  ]);
  assert.equal(stepRangeLabel(s1, seq), "11-10 08:00~11:00");
  assert.equal(stepRangeLabel(s2, seq), "11-10 10:30~12:30");
  assert.equal(stepRangeLabel(s1, { ...seq, start_time: "22:00" }), "11-10 22:00~11-11 01:00");
});

test("작업 순서: 시작일이 없으면 순서표 시작 기준(일째·시간)", () => {
  const [s1, s2] = scheduleSteps([
    { duration: 2, overlap: 0 },
    { duration: 1, overlap: 0 },
  ]);
  assert.equal(stepRangeLabel(s1, { unit: "day", start_date: null, start_time: null }), "1일째~2일째");
  assert.equal(stepRangeLabel(s2, { unit: "day", start_date: null, start_time: null }), "3일째");
  assert.equal(stepRangeLabel(s1, { unit: "hour", start_date: null, start_time: null }), "+0~+2시간");
  assert.equal(sequenceRangeLabel([], { unit: "day", start_date: null, start_time: null }), "-");
});

test("작업 순서: 흐름 차트 칸 — 일은 날짜·요일(토·일 표시), 시간은 시각·날짜가 바뀌는 칸", () => {
  const days = chartColumns(3, { unit: "day", start_date: "2026-11-13", start_time: null });
  assert.deepEqual(days, [
    { label: "11-13", sub: "금", weekend: false },
    { label: "11-14", sub: "토", weekend: true },
    { label: "11-15", sub: "일", weekend: true },
  ]);
  const hours = chartColumns(2.5, { unit: "hour", start_date: "2026-11-10", start_time: "23:00" });
  assert.deepEqual(
    hours.map((c) => [c.label, c.sub]),
    [
      ["23", "11-10"],
      ["00", "11-11"],
      ["01", ""],
    ]
  );
  assert.equal(chartColumns(0, { unit: "day", start_date: null, start_time: null }).length, 1);
});
