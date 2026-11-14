import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateOwnerInsurance as estimate,
  estimatedRatesNote,
  insuranceRatesFor,
  ownerHealthSettlement as settlement,
  pensionRateFor,
} from "@/lib/ownerSocialInsurance";

// 아래 금액 검사는 2027년 요율(국민연금 10%·상한 659만원·하한 41만원, 건강보험 7.19%, 장기요양 13.90%) 기준.
const R2027 = insuranceRatesFor(2027);
const estimateOwnerInsurance = (profit: number, months = 12) => estimate(profit, months, R2027);
const ownerHealthSettlement = (profit: number, months: number, paid: number) => settlement(profit, months, paid, R2027);

test("국민연금은 기준소득월액 상한(659만원)까지만 — 이익이 커도 월 659,000원", () => {
  const r = estimateOwnerInsurance(264_000_000);
  assert.equal(r.pensionMonthly, 659_000);
  assert.equal(r.pensionYearly, 7_908_000);
});

test("건강보험은 월소득 × 7.19%, 장기요양은 그 13.90% — 10원 미만 버림", () => {
  // 월 1,000만원: 건강 719,000 + 장기요양 99,941 → 99,940
  const r = estimateOwnerInsurance(120_000_000);
  assert.equal(r.healthMonthly, 719_000 + 99_940);
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
  // 6개월에 6,000만원 → 월 1,000만원 → 건강 719,000 + 장기요양 99,940
  assert.equal(estimateOwnerInsurance(60_000_000, 6).healthMonthly, 818_940);
});

test("건강보험 정산 = (올해 이익 기준 월 보험료 − 매달 낸 금액) × 개월수", () => {
  // 월 1,000만원 소득(12개월) → 월 818,940, 매달 300,000 냈으면 차액 518,940 × 12
  assert.equal(ownerHealthSettlement(120_000_000, 12, 300_000), 518_940 * 12);
  // 이미 더 많이 냈으면 음수(돌려받음)
  assert.ok(ownerHealthSettlement(12_000_000, 12, 300_000) < 0);
});

test("요율 표: 국민연금은 법정 일정(2026년 9.5%부터 매년 0.5%p, 2033년 13%에서 멈춤)", () => {
  assert.equal(pensionRateFor(2024), 0.09);
  assert.equal(pensionRateFor(2025), 0.09);
  assert.equal(pensionRateFor(2026), 0.095);
  assert.equal(pensionRateFor(2027), 0.1);
  assert.equal(pensionRateFor(2030), 0.115);
  assert.equal(pensionRateFor(2033), 0.13);
  assert.equal(pensionRateFor(2040), 0.13);
});

test("요율 표: 연도마다 그 해 값, 상·하한은 그 해 1~6월에 쓰는 전년 7월 기준", () => {
  const r2026 = insuranceRatesFor(2026);
  assert.equal(r2026.pensionRate, 0.095);
  assert.equal(r2026.pensionMonthlyCap, 6_370_000);
  assert.equal(r2026.pensionMonthlyFloor, 400_000);
  assert.equal(r2026.healthRate, 0.0719);
  assert.equal(r2026.longTermCareOfHealth, 0.1314);
  assert.deepEqual(r2026.estimated, []);
  assert.equal(estimatedRatesNote(r2026), "");

  assert.equal(R2027.pensionRate, 0.1);
  assert.equal(R2027.pensionMonthlyCap, 6_590_000);
  assert.equal(R2027.pensionMonthlyFloor, 410_000);
  assert.equal(R2027.healthRate, 0.0719);
  // 2027년 장기요양 요율(건강보험료의 13.90%)은 2026년 10월 30일 결정 → 추정 표시 없음
  assert.equal(R2027.longTermCareOfHealth, 0.139);
  assert.deepEqual(R2027.estimated, []);
  assert.equal(estimatedRatesNote(R2027), "");
  // 2028년은 건강보험·장기요양이 아직 미정 → 2027년 요율로 추정하고 화면에 표시(상·하한은 2027년 7월 고시 전)
  const r2028 = insuranceRatesFor(2028);
  assert.deepEqual(r2028.estimated.map((e) => `${e.item}:${e.fromYear}`), ["pensionLimits:2026", "health:2027", "longTermCare:2027"]);
  assert.match(estimatedRatesNote(r2028), /장기요양 2028년 요율 미확정 — 2027년 요율 적용/);
});

test("요율 표: 표에 없는 먼 해는 가장 최근 값으로 추정하고 무엇을 추정했는지 남김", () => {
  const r = insuranceRatesFor(2030);
  assert.equal(r.pensionRate, 0.115); // 법정 일정이라 추정 아님
  assert.equal(r.pensionMonthlyCap, 6_590_000);
  assert.deepEqual(
    r.estimated.map((e) => `${e.item}:${e.fromYear}`),
    ["pensionLimits:2026", "health:2027", "longTermCare:2027"]
  );
  assert.match(estimatedRatesNote(r), /국민연금 기준소득월액 상·하한 2029년 7월 고시 전 — 2026년 7월 기준 적용 · 건강보험 2030년 요율 미확정 — 2027년 요율 적용/);
  // 표보다 이른 해는 가장 이른 값
  assert.equal(insuranceRatesFor(2020).healthRate, 0.0709);
});

test("요율 표: 2026년 요율이면 국민연금 9.5%·상한 637만원 기준으로 계산", () => {
  const r2026 = insuranceRatesFor(2026);
  assert.equal(estimate(264_000_000, 12, r2026).pensionMonthly, 605_150); // 6,370,000 × 9.5%
  assert.equal(estimate(36_000_000, 12, r2026).pensionMonthly, 285_000); // 월 300만원 × 9.5%
});
