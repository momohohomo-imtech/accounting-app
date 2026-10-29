import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicatePayrollNames, monthRangeOf } from "@/lib/payrollDuplicates";

test("급여 중복: 그 달 범위(다음 달 1일 전까지), 12월은 다음 해 1월까지", () => {
  assert.deepEqual(monthRangeOf("2026-09-25"), { start: "2026-09-01", end: "2026-10-01" });
  assert.deepEqual(monthRangeOf("2026-12"), { start: "2026-12-01", end: "2027-01-01" });
});

test("급여 중복: 같은 직원·같은 달이 이미 있으면 그 직원 이름(가짜 이름)", () => {
  const existing = [
    { employee_id: "e1", pay_month: "2026-09-10", name: "가짜 직원A" },
    { employee_id: "e2", pay_month: "2026-08-25", name: "가짜 직원B" },
  ];
  const incoming = [
    { employee_id: "e1", pay_month: "2026-09-25" },
    { employee_id: "e1", pay_month: "2026-09-25" },
    { employee_id: "e2", pay_month: "2026-09-25" },
    { employee_id: "e3", pay_month: "2026-09-25" },
  ];
  assert.deepEqual(duplicatePayrollNames(incoming, existing), ["가짜 직원A"]);
  assert.deepEqual(duplicatePayrollNames(incoming, []), []);
});
