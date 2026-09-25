import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateOwnerInsurance, ownerHealthSettlement, ownerPensionBackPay } from "@/lib/ownerSocialInsurance";

test("국민연금은 기준소득월액 상한(659만원)까지만 — 이익이 커도 월 659,000원", () => {
  const r = estimateOwnerInsurance(264_000_000);
  assert.equal(r.pensionMonthly, 659_000);
  assert.equal(r.pensionYearly, 7_908_000);
});

test("건강보험은 월소득 × 7.19%, 장기요양은 그 13.14% — 10원 미만 버림", () => {
  // 월 1,000만원: 건강 719,000 + 장기요양 94,476.6 → 94,470
  const r = estimateOwnerInsurance(120_000_000);
  assert.equal(r.healthMonthly, 719_000 + 94_470);
  assert.equal(r.pensionMonthly, 659_000);
});

test("상한 아래면 소득 그대로, 하한(41만원) 아래면 하한 적용, 이익이 0 이하면 0", () => {
  assert.equal(estimateOwnerInsurance(36_000_000).pensionMonthly, 300_000); // 월 300만원 × 10%
  assert.equal(estimateOwnerInsurance(1_200_000).pensionMonthly, 41_000); // 월 10만원 → 하한 41만원
  const zero = estimateOwnerInsurance(-5_000_000);
  assert.equal(zero.pensionMonthly, 0);
  assert.equal(zero.healthMonthly, 0);
});

test("사업 기간이 12개월보다 짧으면 이익 ÷ 개월수로 월 소득을 잡음", () => {
  // 6개월에 6,000만원 → 월 1,000만원 → 건강 719,000 + 장기요양 94,470
  assert.equal(estimateOwnerInsurance(60_000_000, 6).healthMonthly, 813_470);
});

test("건강보험 정산 = (올해 이익 기준 월 보험료 − 매달 낸 금액) × 개월수", () => {
  // 월 1,000만원 소득(12개월) → 월 813,470, 매달 300,000 냈으면 차액 513,470 × 12
  assert.equal(ownerHealthSettlement(120_000_000, 12, 300_000), 513_470 * 12);
  // 이미 더 많이 냈으면 음수(돌려받음)
  assert.ok(ownerHealthSettlement(12_000_000, 12, 300_000) < 0);
});

test("국민연금 가입 누락 시 올해분 소급 추정 = 올해 요율(9.5%) × 상한 적용 × 개월수", () => {
  assert.equal(ownerPensionBackPay(264_000_000, 12), 626_050 * 12);
  assert.equal(ownerPensionBackPay(0, 12), 0);
});
