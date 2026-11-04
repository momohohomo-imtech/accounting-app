import { test } from "node:test";
import assert from "node:assert/strict";
import { businessMonthsIn, firstBusinessYear } from "@/lib/businessYear";

test("사업 첫해 = 첫 매출이 있는 해(지난 해 준비기간 매입이 있어도), 매출이 없으면 올해", () => {
  assert.equal(firstBusinessYear("2026-02-10", 2026), 2026);
  assert.equal(firstBusinessYear(null, 2026), 2026);
  assert.equal(firstBusinessYear("2026-02-10", 2027), 2026);
  // 앞으로 날짜로 미리 등록한 매출만 있으면 올해
  assert.equal(firstBusinessYear("2027-01-05", 2026), 2026);
});

test("첫해 사업 기간: 그 해 첫 거래 달부터 12월까지, 거래가 없으면 12개월", () => {
  assert.deepEqual(businessMonthsIn(["2026-03-15", "2026-01-20", "2026-11-02"]), { startMonth: 1, months: 12 });
  assert.deepEqual(businessMonthsIn(["2026-05-02", "2026-08-30"]), { startMonth: 5, months: 8 });
  assert.deepEqual(businessMonthsIn([]), { startMonth: 1, months: 12 });
});
