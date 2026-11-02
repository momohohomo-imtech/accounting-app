import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addHours,
  chartColumns,
  daysBetween,
  formatAmount,
  normalizeAmount,
  plannedRange,
  scheduleSteps,
  sequenceRangeLabel,
  statusLabel,
  stepRangeLabel,
  stepStatus,
  summarizeSequence,
  todayOffset,
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
  assert.deepEqual(schedule[0], { start: 0, end: 2, overlap: 0, overlapClamped: false, predecessor: null, afterInvalid: false });
  assert.deepEqual(schedule[1], { start: 0, end: 1, overlap: 2, overlapClamped: true, predecessor: 0, afterInvalid: false });
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

test("작업 순서: 앞 작업 지정 — 같은 단계 뒤에 여러 단계가 동시에, 처음부터 같이 시작", () => {
  // 1 철거(2일) → 2 배관(3일, 1번 뒤) · 3 전기(2일, 1번 뒤) · 4 마감(1일, 기본 = 바로 앞 3번 뒤) · 5 자재 발주(1일, 처음부터)
  const schedule = scheduleSteps([
    { duration: 2, overlap: 0 },
    { duration: 3, overlap: 0, after: 0 },
    { duration: 2, overlap: 0, after: 0 },
    { duration: 1, overlap: 0 },
    { duration: 1, overlap: 3, after: "start" },
  ]);
  assert.deepEqual(
    schedule.map((s) => [s.start, s.end, s.predecessor]),
    [
      [0, 2, null],
      [2, 5, 0],
      [2, 4, 0],
      [4, 5, 2],
      [0, 1, null],
    ]
  );
  // 처음부터는 겹침을 쓰지 않음
  assert.equal(schedule[4].overlap, 0);
  // 겹침은 고른 앞 작업 기준(1번 뒤 1일 겹침 → 2일째 시작)
  assert.deepEqual(scheduleSteps([{ duration: 2, overlap: 0 }, { duration: 5, overlap: 0 }, { duration: 1, overlap: 1, after: 0 }])[2], {
    start: 1,
    end: 2,
    overlap: 1,
    overlapClamped: false,
    predecessor: 0,
    afterInvalid: false,
  });
});

test("작업 순서: 순번을 바꿔 앞 작업이 뒤로 가면 바로 앞 단계 기준 + 알림(서로 물려 도는 일 없음)", () => {
  const schedule = scheduleSteps([
    { duration: 1, overlap: 0, after: 2 },
    { duration: 2, overlap: 0, after: 5 },
    { duration: 1, overlap: 0, after: 2 },
  ]);
  assert.deepEqual(
    schedule.map((s) => [s.start, s.end, s.predecessor, s.afterInvalid]),
    [
      [0, 1, null, true],
      [1, 3, 0, true],
      [3, 4, 1, true],
    ]
  );
});

const daySeq = { unit: "day" as const, start_date: "2026-11-10", start_time: null };

test("작업 순서: 진행 상태 — 끝날이 지났는데 미완료면 지남, 늦게 완료, 진행 중, 예정", () => {
  const [s1, s2, s3] = scheduleSteps([
    { duration: 2, overlap: 0 },
    { duration: 3, overlap: 0 },
    { duration: 2, overlap: 0 },
  ]); // 11-10~11-11, 11-12~11-14, 11-15~11-16
  const today = { date: "2026-11-13", time: "09:00" };
  assert.deepEqual(plannedRange(s2, daySeq), { start: "2026-11-12", end: "2026-11-14" });
  assert.deepEqual(stepStatus({ done: false, done_date: null }, s1, daySeq, today), { state: "overdue", lateBy: 2, lateUnit: "day" });
  assert.equal(stepStatus({ done: false, done_date: null }, s2, daySeq, today).state, "inProgress");
  assert.equal(stepStatus({ done: false, done_date: null }, s3, daySeq, today).state, "upcoming");
  assert.deepEqual(stepStatus({ done: true, done_date: "2026-11-12" }, s1, daySeq, today), { state: "doneLate", lateBy: 1, lateUnit: "day" });
  assert.equal(stepStatus({ done: true, done_date: "2026-11-11" }, s1, daySeq, today).state, "done");
  assert.equal(stepStatus({ done: true, done_date: null }, s1, daySeq, today).state, "done");
  // 끝날 당일은 아직 안 지남
  assert.equal(stepStatus({ done: false, done_date: null }, s1, daySeq, { date: "2026-11-11", time: "23:00" }).state, "inProgress");
  // 시작일이 없으면 판단 안 함
  assert.equal(stepStatus({ done: false, done_date: null }, s1, { ...daySeq, start_date: null }, today).state, "noDate");
  assert.equal(statusLabel({ state: "overdue", lateBy: 2, lateUnit: "day" }), "2일 지남");
  assert.equal(statusLabel({ state: "doneLate", lateBy: 1, lateUnit: "day" }), "1일 늦게 완료");
  assert.equal(statusLabel({ state: "inProgress", lateBy: 0, lateUnit: "day" }), "진행 중");
  assert.equal(statusLabel({ state: "upcoming", lateBy: 0, lateUnit: "day" }), "");
  assert.equal(daysBetween("2026-12-31", "2027-01-02"), 2);
});

test("작업 순서: 시간 단위 상태 — 끝 시각이 지나면 지남(시간), 24시간 넘으면 일", () => {
  const hourSeq = { unit: "hour" as const, start_date: "2026-11-10", start_time: "08:00" };
  const [s1] = scheduleSteps([{ duration: 3, overlap: 0 }]); // 08:00~11:00
  assert.deepEqual(stepStatus({ done: false, done_date: null }, s1, hourSeq, { date: "2026-11-10", time: "12:10" }), {
    state: "overdue",
    lateBy: 1.5,
    lateUnit: "hour",
  });
  assert.equal(stepStatus({ done: false, done_date: null }, s1, hourSeq, { date: "2026-11-10", time: "09:00" }).state, "inProgress");
  assert.equal(stepStatus({ done: false, done_date: null }, s1, hourSeq, { date: "2026-11-10", time: "07:00" }).state, "upcoming");
  assert.equal(statusLabel({ state: "overdue", lateBy: 1.5, lateUnit: "hour" }), "1.5시간 지남");
  assert.equal(statusLabel({ state: "overdue", lateBy: 50, lateUnit: "hour" }), "2일 지남");
});

test("작업 순서: 차트 오늘 위치 — 일은 오늘 칸 가운데, 시간은 지금 시각, 차트 밖이면 없음", () => {
  assert.equal(todayOffset(daySeq, { date: "2026-11-12", time: "10:00" }, 5), 2.5);
  assert.equal(todayOffset(daySeq, { date: "2026-11-30", time: "10:00" }, 5), null);
  assert.equal(todayOffset(daySeq, { date: "2026-11-09", time: "10:00" }, 5), null);
  assert.equal(todayOffset({ ...daySeq, start_date: null }, { date: "2026-11-12", time: "10:00" }, 5), null);
  const hourSeq = { unit: "hour" as const, start_date: "2026-11-10", start_time: "08:00" };
  assert.equal(todayOffset(hourSeq, { date: "2026-11-10", time: "09:30" }, 4), 1.5);
  assert.equal(todayOffset(hourSeq, { date: "2026-11-11", time: "09:00" }, 4), null);
});

test("작업 순서: 목록 상태 요약 — 지연 N단계가 먼저, 다 끝나면 완료", () => {
  const steps = [
    { done: false, done_date: null },
    { done: false, done_date: null },
  ];
  const schedule = scheduleSteps([
    { duration: 2, overlap: 0 },
    { duration: 2, overlap: 0 },
  ]); // 11-10~11-11, 11-12~11-13
  assert.deepEqual(summarizeSequence(steps, schedule, daySeq, { date: "2026-11-15", time: "09:00" }), {
    label: "지연 2단계",
    tone: "late",
    rank: 102,
  });
  assert.equal(summarizeSequence(steps, schedule, daySeq, { date: "2026-11-11", time: "09:00" }).label, "진행 중");
  assert.equal(summarizeSequence(steps, schedule, daySeq, { date: "2026-11-01", time: "09:00" }).label, "예정");
  assert.equal(
    summarizeSequence(steps.map(() => ({ done: true, done_date: "2026-11-20" })), schedule, daySeq, { date: "2026-11-30", time: "09:00" }).label,
    "완료"
  );
  assert.equal(summarizeSequence(steps, schedule, { ...daySeq, start_date: null }, { date: "2026-11-15", time: "09:00" }).label, "시작일 없음");
  assert.equal(summarizeSequence([], [], daySeq, { date: "2026-11-15", time: "09:00" }).label, "-");
});
