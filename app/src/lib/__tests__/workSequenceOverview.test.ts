import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleSteps } from "@/lib/workSequence";
import { buildAgenda, dayLabel, rangeLabel, teamSchedule, type OverviewSequence } from "@/lib/workSequenceOverview";

// 가짜 자료만 — 순서표 3개(A·B는 같은 이름 "설비팀", C는 시작일이 지난 늦은 작업 하나, D는 시작일 없음)
const step = (content: string, team_id: string | null = null, done = false, done_date: string | null = null) => ({ content, team_id, done, done_date });

const A: OverviewSequence = {
  id: "A",
  title: "가짜 A 순서",
  projectLabel: "가짜 A현장 · 가짜 공사1",
  seq: { unit: "day", start_date: "2026-11-01", start_time: null },
  teams: [
    { id: "a", name: "설비팀", color: "orange" },
    { id: "b", name: "전기팀", color: "aqua" },
  ],
  steps: [step("가짜 철거", null, true, "2026-11-02"), step("가짜 배관", "a"), step("가짜 배선", "b")],
  schedule: scheduleSteps([
    { duration: 2, overlap: 0 },
    { duration: 3, overlap: 0 },
    { duration: 2, overlap: 0, after: 0 },
  ]),
};
const B: OverviewSequence = {
  id: "B",
  title: "가짜 B 순서",
  projectLabel: "가짜 B현장 · 가짜 공사2",
  seq: { unit: "day", start_date: "2026-11-04", start_time: null },
  teams: [{ id: "x", name: "설비팀", color: "green" }],
  steps: [step("가짜 압력 시험", "x"), step("가짜 정리")],
  schedule: scheduleSteps([
    { duration: 1, overlap: 0 },
    { duration: 1, overlap: 0 },
  ]),
};
const C: OverviewSequence = {
  id: "C",
  title: "가짜 C 순서",
  projectLabel: "가짜 C현장 · 가짜 공사3",
  seq: { unit: "day", start_date: "2026-10-20", start_time: null },
  teams: [],
  steps: [step("가짜 점검")],
  schedule: scheduleSteps([{ duration: 2, overlap: 0 }]),
};
const D: OverviewSequence = { ...C, id: "D", title: "가짜 D 순서", seq: { unit: "day", start_date: null, start_time: null } };
const today = { date: "2026-11-03", time: "09:00" };

test("모아 보기: 오늘·이번 주 할 일 — 늦은 작업(계획 끝 지남)·오늘 작업·이번 주 시작, 완료·시작일 없음은 빼기", () => {
  const agenda = buildAgenda([A, B, C, D], today);
  assert.deepEqual(
    agenda.overdue.map((x) => [x.seqId, x.stepNo, x.lateLabel, x.from, x.to]),
    [["C", 1, "13일 지남", "2026-10-20", "2026-11-03"]]
  );
  assert.deepEqual(
    agenda.today.map((x) => [x.seqId, x.stepNo, x.team?.name ?? "-", x.from, x.to]),
    [
      ["A", 2, "설비팀", "2026-11-03", "2026-11-05"],
      ["A", 3, "전기팀", "2026-11-03", "2026-11-04"],
    ]
  );
  assert.deepEqual(
    agenda.week.map((x) => [x.seqId, x.stepNo, x.from]),
    [
      ["B", 1, "2026-11-04"],
      ["B", 2, "2026-11-05"],
    ]
  );
  assert.equal(agenda.weekEnd, "2026-11-09");
  // 같은 이름 팀은 모아 보기에서 한 색(먼저 나온 A의 주황) — B 순서표에선 초록이어도
  assert.equal(agenda.week[0].team?.color, "orange");
  assert.equal(agenda.skipped, 1);
});

test("모아 보기: 팀별 일정 — 이름이 같으면 한 팀, 다른 순서표끼리 같은 날이면 겹침, 2주 밖·완료·팀 미정은 빼기", () => {
  const { days, rows } = teamSchedule([A, B, C, D], today, 14);
  assert.equal(days.length, 14);
  assert.equal(days[0].date, "2026-11-03");
  assert.equal(days[13].date, "2026-11-16");
  assert.deepEqual(
    days.filter((d) => d.weekend).map((d) => d.date),
    ["2026-11-07", "2026-11-08", "2026-11-14", "2026-11-15"]
  );
  assert.deepEqual(
    rows.map((r) => [r.name, r.color, r.items.map((x) => `${x.seqId}${x.stepNo}`).join(",")]),
    [
      ["설비팀", "orange", "A2,B1"],
      ["전기팀", "aqua", "A3"],
    ]
  );
  const seolbi = rows[0];
  assert.deepEqual(seolbi.perDay.slice(0, 4), [1, 2, 1, 0]);
  assert.deepEqual(
    seolbi.conflicts.map((c) => [c.from, c.to, c.items.map((x) => `${x.seqId}${x.stepNo}`).join(",")]),
    [["2026-11-04", "2026-11-04", "A2,B1"]]
  );
  assert.deepEqual(rows[1].conflicts, []);
});

test("모아 보기: 이어진 겹침 날은 한 구간, 같은 순서표 안 겹침은 여기서 알리지 않음", () => {
  const E: OverviewSequence = {
    ...B,
    id: "E",
    title: "가짜 E 순서",
    seq: { unit: "day", start_date: "2026-11-03", start_time: null },
    steps: [step("가짜 긴 작업", "x"), step("가짜 같은 순서표 작업", "x")],
    schedule: scheduleSteps([
      { duration: 3, overlap: 0 },
      { duration: 1, overlap: 0, after: "start" },
    ]),
  };
  const { rows } = teamSchedule([A, E], today, 14);
  const seolbi = rows.find((r) => r.name === "설비팀")!;
  // 11-03: A2·E1·E2(다른 순서표 있음) / 11-04~11-05: A2·E1 — 날마다 작업 묶음이 다르면 구간을 나눔
  assert.deepEqual(
    seolbi.conflicts.map((c) => [c.from, c.to, c.items.length]),
    [
      ["2026-11-03", "2026-11-03", 3],
      ["2026-11-04", "2026-11-05", 2],
    ]
  );
  const onlyE = teamSchedule([E], today, 14).rows[0];
  assert.deepEqual(onlyE.conflicts, []);
  assert.equal(onlyE.perDay[0], 2);
});

test("모아 보기: 날짜 글자", () => {
  assert.equal(dayLabel("2026-11-05"), "11-05(목)");
  assert.equal(rangeLabel("2026-11-05", "2026-11-05"), "11-05(목)");
  assert.equal(rangeLabel("2026-11-05", "2026-11-07"), "11-05(목)~11-07(토)");
});
