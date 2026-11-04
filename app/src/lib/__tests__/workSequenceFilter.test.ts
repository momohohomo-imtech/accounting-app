import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastSchedule, forecastSummary, scheduleSteps } from "@/lib/workSequence";
import {
  matchesSequenceFilter,
  parseSequenceFilter,
  sequenceFilterQuery,
  sequenceYearOptions,
  sequenceYears,
  yearParamInAddress,
} from "@/lib/workSequenceFilter";

// 가짜 자료만
test("주소 읽기: 연도가 없거나 잘못되면 올해, 전체는 all, 현장이 없으면 전체", () => {
  assert.deepEqual(parseSequenceFilter({}, 2026), { year: "2026", site: "all" });
  assert.deepEqual(parseSequenceFilter({ seqYear: "all" }, 2026), { year: "all", site: "all" });
  assert.deepEqual(parseSequenceFilter({ seqYear: "2025", seqSite: "site-a" }, 2026), { year: "2025", site: "site-a" });
  assert.deepEqual(parseSequenceFilter({ seqYear: "가짜", seqSite: " " }, 2026), { year: "2026", site: "all" });
  assert.deepEqual(parseSequenceFilter({ seqSite: "none" }, 2026), { year: "2026", site: "none" });
  assert.equal(yearParamInAddress(undefined), false);
  assert.equal(yearParamInAddress("가짜"), false);
  assert.equal(yearParamInAddress("all"), true);
  assert.equal(yearParamInAddress("2025"), true);
});

test("순서표가 걸친 해: 시작일 ~ 계획·예상 끝 중 늦은 날, 시작일이 없으면 프로젝트 연도", () => {
  const plan = scheduleSteps([
    { duration: 3, overlap: 0 },
    { duration: 3, overlap: 0 },
  ]); // 6일
  // 한 해 안
  assert.deepEqual(sequenceYears({ unit: "day", start_date: "2026-03-02", start_time: null }, plan, null, 2025), [2026]);
  // 해를 넘김(12-29 ~ 01-03)
  assert.deepEqual(sequenceYears({ unit: "day", start_date: "2025-12-29", start_time: null }, plan, null, 2025), [2025, 2026]);
  // 계획은 그 해 안인데 예상이 늦어져 해를 넘김
  assert.deepEqual(sequenceYears({ unit: "day", start_date: "2025-12-20", start_time: null }, plan, 15, 2025), [2025, 2026]);
  // 시작일 없음 → 프로젝트 연도, 그것도 없으면 빈 목록
  assert.deepEqual(sequenceYears({ unit: "day", start_date: null, start_time: null }, plan, null, 2024), [2024]);
  assert.deepEqual(sequenceYears({ unit: "day", start_date: null, start_time: null }, plan, null, null), []);
  // 단계가 없으면 시작일의 해
  assert.deepEqual(sequenceYears({ unit: "day", start_date: "2026-05-01", start_time: null }, [], null, 2025), [2026]);
  // 시간 단위: 12-31 22:00부터 4시간 → 다음 해 01-01까지
  const hours = scheduleSteps([{ duration: 4, overlap: 0 }]);
  assert.deepEqual(sequenceYears({ unit: "hour", start_date: "2025-12-31", start_time: "22:00" }, hours, null, 2025), [2025, 2026]);
  // 시간 단위: 12-31 20:00부터 4시간 → 24시(0시)에 끝나면 그날까지
  assert.deepEqual(sequenceYears({ unit: "hour", start_date: "2025-12-31", start_time: "20:00" }, hours, null, 2025), [2025]);
});

test("안 끝난 늦은 작업이 있는 지난해 순서표는 오늘까지 이어진 것으로 — 올해에도 보임", () => {
  const seq = { unit: "day" as const, start_date: "2025-11-03", start_time: null };
  const steps = [
    { done: true, done_date: "2025-11-05" },
    { done: false, done_date: null },
  ];
  const plan = scheduleSteps([
    { duration: 3, overlap: 0 },
    { duration: 5, overlap: 0 },
  ]);
  const summary = forecastSummary(forecastSchedule(steps, plan, seq, { date: "2026-02-10", time: "09:00" }), plan, seq, steps);
  assert.deepEqual(sequenceYears(seq, plan, summary?.forecastEnd, 2025), [2025, 2026]);
  // 다 끝났으면 실제 완료일까지만
  const finished = steps.map(() => ({ done: true, done_date: "2025-11-12" }));
  const done = forecastSummary(forecastSchedule(finished, plan, seq, { date: "2026-02-10", time: "09:00" }), plan, seq, finished);
  assert.deepEqual(sequenceYears(seq, plan, done?.forecastEnd, 2025), [2025]);
});

test("필터 맞춤: 연도는 걸친 해 중 하나, 현장 없는 순서표는 현장 미지정(none)으로", () => {
  const a = { years: [2025, 2026], siteId: "site-a" };
  const noSite = { years: [2026], siteId: null };
  const noYear = { years: [], siteId: "site-a" };
  assert.equal(matchesSequenceFilter(a, { year: "all", site: "all" }), true);
  assert.equal(matchesSequenceFilter(a, { year: "2025", site: "all" }), true);
  assert.equal(matchesSequenceFilter(a, { year: "2024", site: "all" }), false);
  assert.equal(matchesSequenceFilter(a, { year: "2026", site: "site-a" }), true);
  assert.equal(matchesSequenceFilter(a, { year: "2026", site: "site-b" }), false);
  assert.equal(matchesSequenceFilter(noSite, { year: "2026", site: "none" }), true);
  assert.equal(matchesSequenceFilter(a, { year: "2026", site: "none" }), false);
  assert.equal(matchesSequenceFilter(noYear, { year: "2026", site: "all" }), false);
  assert.equal(matchesSequenceFilter(noYear, { year: "all", site: "site-a" }), true);
});

test("연도 선택 목록과 팝업 주소에 붙일 필터", () => {
  assert.deepEqual(sequenceYearOptions([[2024], [2025, 2026], []], 2026, "2026"), [2026, 2025, 2024]);
  assert.deepEqual(sequenceYearOptions([], 2026, "2023"), [2026, 2023]);
  assert.deepEqual(sequenceYearOptions([[2027]], 2026, "all"), [2027, 2026]);
  assert.equal(sequenceFilterQuery({ year: "2026", site: "all" }, false), "");
  assert.equal(sequenceFilterQuery({ year: "2025", site: "all" }, true), "&seqYear=2025");
  assert.equal(sequenceFilterQuery({ year: "all", site: "none" }, true), "&seqYear=all&seqSite=none");
  assert.equal(sequenceFilterQuery({ year: "2026", site: "가짜 현장" }, false), `&seqSite=${encodeURIComponent("가짜 현장")}`);
});
