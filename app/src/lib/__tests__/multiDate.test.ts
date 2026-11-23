import { test } from "node:test";
import assert from "node:assert/strict";
import { groupIdsPerDate, MAX_MULTI_DATES, multiDateLabel, multiDateRows, toggleDate } from "@/lib/multiDate";

test("여러 날짜: 누르면 넣고 다시 누르면 뺌, 늘 날짜 순·한 번만, 날짜가 아닌 값은 무시", () => {
  let d = toggleDate([], "2026-11-05");
  d = toggleDate(d, "2026-11-03");
  d = toggleDate(d, "2026-12-01");
  assert.deepEqual(d, ["2026-11-03", "2026-11-05", "2026-12-01"]);
  assert.deepEqual(toggleDate(d, "2026-11-05"), ["2026-11-03", "2026-12-01"]);
  assert.deepEqual(toggleDate(d, "11월 5일"), d);
  assert.equal(MAX_MULTI_DATES, 62);
});

test("여러 날짜: 날짜마다 같은 줄들 — 날짜 순, 한 날짜 안은 줄 순서", () => {
  const rows = multiDateRows(["2026-11-05", "2026-11-03", "2026-11-05"], ["식대", "음료"], (item, date) => `${date} ${item}`);
  assert.deepEqual(rows, ["2026-11-03 식대", "2026-11-03 음료", "2026-11-05 식대", "2026-11-05 음료"]);
  assert.deepEqual(multiDateRows([], ["식대"], (i, d) => d + i), []);
});

test("여러 날짜: 한 결제로 묶기는 날짜마다(줄이 2개 이상인 날짜만)", () => {
  let n = 0;
  const ids = groupIdsPerDate(
    [{ trans_date: "2026-11-03" }, { trans_date: "2026-11-03" }, { trans_date: "2026-11-05" }],
    () => `g${++n}`
  );
  assert.deepEqual([...ids.entries()], [["2026-11-03", "g1"]]);
  const two = groupIdsPerDate(
    [{ trans_date: "2026-11-03" }, { trans_date: "2026-11-03" }, { trans_date: "2026-11-05" }, { trans_date: "2026-11-05" }],
    () => `g${++n}`
  );
  assert.equal(two.size, 2);
  assert.notEqual(two.get("2026-11-03"), two.get("2026-11-05"));
});

test("여러 날짜: 날짜 글자 — 짧게, 해가 둘이면 연도, 많으면 외 N일", () => {
  assert.equal(multiDateLabel(["2026-11-12", "2026-11-03", "2026-11-05"]), "11/3, 11/5, 11/12");
  assert.equal(multiDateLabel(["2026-12-31", "2027-01-02"]), "2026.12/31, 2027.1/2");
  const many = Array.from({ length: 15 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
  assert.equal(multiDateLabel(many), "11/1, 11/2, 11/3, 11/4, 11/5, 11/6, 11/7, 11/8, 11/9, 11/10, 11/11, 11/12 외 3일");
});
