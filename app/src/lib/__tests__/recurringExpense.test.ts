import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentStatus,
  duePosts,
  isRecurringDuplicate,
  kstDateOf,
  missedOlderCount,
  nextScheduled,
  postAmounts,
  postTotal,
  recurringNote,
  scheduledDate,
  startBoundary,
  statusLabel,
  type RecurringExpense,
} from "@/lib/recurringExpense";

// 가짜 항목 — 10월 1일(한국 시각)에 만든 매달 5일 결제
const base: RecurringExpense = {
  id: "r1",
  name: "가짜 인터넷 요금",
  pay_day: 5,
  client_id: null,
  client_name_raw: "가짜 통신사",
  item_name: null,
  amount: 33_000,
  add_vat: false,
  tax_invoice_issued: false,
  payment_method_id: null,
  category_id: null,
  start_date: null,
  end_date: null,
  paused: false,
  memo: null,
  created_at: "2026-09-30T16:00:00Z", // 한국 시각 10/1 01:00
};
const none = new Set<string>();

test("고정지출: 결제일 — 그 달에 없는 날은 말일(31일 → 2월 28·29일, 4월 30일)", () => {
  assert.equal(scheduledDate(2026, 11, 5), "2026-11-05");
  assert.equal(scheduledDate(2026, 2, 31), "2026-02-28");
  assert.equal(scheduledDate(2028, 2, 30), "2028-02-29");
  assert.equal(scheduledDate(2026, 4, 31), "2026-04-30");
  assert.equal(scheduledDate(2026, 12, 31), "2026-12-31");
});

test("고정지출: 시작 기준 — 시작일, 비었으면 만든 날(한국 날짜)", () => {
  assert.equal(kstDateOf("2026-09-30T16:00:00Z"), "2026-10-01");
  assert.equal(startBoundary(base), "2026-10-01");
  assert.equal(startBoundary({ ...base, start_date: "2026-09-01" }), "2026-09-01");
});

test("고정지출: 결제일이 됐으면 올림 — 결제일 전엔 안 올림, 이미 올린 달은 안 올림, 지난달 몫까지 따라잡음", () => {
  assert.deepEqual(duePosts(base, "2026-11-04", new Set(["2026-10-01"])), []);
  assert.deepEqual(duePosts(base, "2026-11-05", new Set(["2026-10-01"])), [{ month: "2026-11-01", date: "2026-11-05" }]);
  assert.deepEqual(duePosts(base, "2026-11-20", new Set(["2026-10-01", "2026-11-01"])), []);
  // 서버가 10월 5일을 놓쳤으면 11월 3일에 10월 몫(10/5 날짜)을 올림
  assert.deepEqual(duePosts(base, "2026-11-03", none), [{ month: "2026-10-01", date: "2026-10-05" }]);
  // 지난달·이번 달 둘 다 → 날짜 순
  assert.deepEqual(duePosts(base, "2026-11-06", none), [
    { month: "2026-10-01", date: "2026-10-05" },
    { month: "2026-11-01", date: "2026-11-05" },
  ]);
  // 해를 넘겨도(1월에 12월 몫)
  assert.deepEqual(duePosts({ ...base, pay_day: 31 }, "2027-01-02", none), [{ month: "2026-12-01", date: "2026-12-31" }]);
});

test("고정지출: 만들기 전 결제일·시작일 전·끝나는 날 뒤·일시 중지는 안 올림", () => {
  // 10/20에 만든 5일 결제 → 10월 몫(10/5)은 안 올림, 11/5부터
  const lateCreated = { ...base, created_at: "2026-10-20T03:00:00Z" };
  assert.deepEqual(duePosts(lateCreated, "2026-10-25", none), []);
  assert.deepEqual(duePosts(lateCreated, "2026-11-05", none), [{ month: "2026-11-01", date: "2026-11-05" }]);
  // 시작일을 앞으로 두면 이번 달 지난 결제일도 올림(사용자가 고른 것)
  assert.deepEqual(duePosts({ ...lateCreated, start_date: "2026-10-01" }, "2026-10-25", none), [
    { month: "2026-10-01", date: "2026-10-05" },
  ]);
  assert.deepEqual(duePosts({ ...base, end_date: "2026-11-04" }, "2026-11-10", new Set(["2026-10-01"])), []);
  assert.deepEqual(duePosts({ ...base, paused: true }, "2026-11-10", none), []);
});

test("고정지출: 금액 — 부가세 별도면 10% 더함(거래 등록과 같음), 합계", () => {
  assert.deepEqual(postAmounts(base), { purchase_amount: 33_000, purchase_vat: 0, vat_included: false });
  assert.deepEqual(postAmounts({ amount: 30_000, add_vat: true }), { purchase_amount: 30_000, purchase_vat: 3_000, vat_included: true });
  assert.equal(postTotal({ amount: 30_005, add_vat: true }), 33_006);
  assert.equal(recurringNote(" 가짜 인터넷 요금 "), "[고정지출 자동] 가짜 인터넷 요금");
});

test("고정지출: 이번 달 칸 — 올림·예정·올릴 차례·시작 전·끝남·일시 중지, 다음 결제일", () => {
  const posted = new Set(["2026-10-01", "2026-11-01"]);
  assert.equal(statusLabel(currentStatus(base, "2026-11-20", posted)), "올림 · 11/5");
  assert.equal(statusLabel(currentStatus(base, "2026-11-03", new Set(["2026-10-01"]))), "예정 · 11/5");
  assert.equal(statusLabel(currentStatus(base, "2026-11-06", new Set(["2026-10-01"]))), "올릴 차례 · 11/5");
  assert.equal(statusLabel(currentStatus({ ...base, created_at: "2026-11-10T00:00:00Z" }, "2026-11-12", none)), "시작 전 · 다음 12/5");
  assert.equal(statusLabel(currentStatus({ ...base, end_date: "2026-11-30" }, "2026-12-10", posted)), "끝남");
  assert.equal(statusLabel(currentStatus({ ...base, paused: true }, "2026-11-10", none)), "일시 중지");
  assert.equal(nextScheduled(base, "2026-11-05"), "2026-12-05");
  assert.equal(nextScheduled(base, "2026-11-04"), "2026-11-05");
  assert.equal(nextScheduled({ ...base, end_date: "2026-11-30" }, "2026-11-05"), null);
  assert.equal(nextScheduled({ ...base, paused: true }, "2026-11-04"), null);
});

test("고정지출: 지난달보다 앞서 못 올린 결제일 수(자동으로 안 올림 — 안내용)", () => {
  // 10/1에 만든 항목, 오늘 12/10, 10월·11월·12월 기록 없음 → 지난달(11월)·이번 달은 자동, 10월 몫 1건이 안내 대상
  assert.equal(missedOlderCount(base, "2026-12-10", none), 1);
  assert.equal(missedOlderCount(base, "2026-12-10", new Set(["2026-10-01"])), 0);
  assert.equal(missedOlderCount({ ...base, paused: true }, "2026-12-10", none), 0);
});

test("고정지출: 은행 등록 겹침 — 같은 날·같은 합계·자동 표시가 있는 매입 줄만", () => {
  const row = { type: "매입", trans_date: "2026-11-05", purchase_amount: 30_000, purchase_vat: 3_000, note1: "[고정지출 자동] 가짜 인터넷 요금" };
  assert.equal(isRecurringDuplicate(row, { trans_date: "2026-11-05", amount: 33_000 }), true);
  assert.equal(isRecurringDuplicate(row, { trans_date: "2026-11-06", amount: 33_000 }), false);
  assert.equal(isRecurringDuplicate(row, { trans_date: "2026-11-05", amount: 30_000 }), false);
  assert.equal(isRecurringDuplicate({ ...row, note1: "직접 넣은 줄" }, { trans_date: "2026-11-05", amount: 33_000 }), false);
  assert.equal(isRecurringDuplicate({ ...row, type: "매출" }, { trans_date: "2026-11-05", amount: 33_000 }), false);
});
