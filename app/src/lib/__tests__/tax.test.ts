import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateIncomeTax, taxEstimate, incomeTaxInstallment, interimPrepayment } from "@/lib/tax";

test("종합소득세 누진공제 — 구간 경계", () => {
  assert.equal(estimateIncomeTax(0), 0);
  assert.equal(estimateIncomeTax(-5_000_000), 0);
  assert.equal(estimateIncomeTax(14_000_000), 840_000); // 6%
  assert.equal(estimateIncomeTax(14_000_001), Math.round(14_000_001 * 0.15 - 1_260_000)); // 15% 구간 시작
  assert.equal(estimateIncomeTax(50_000_000), 6_240_000); // 50,000,000 × 15% − 1,260,000
  assert.equal(estimateIncomeTax(88_000_000), 15_360_000); // × 24% − 5,760,000
  assert.equal(estimateIncomeTax(150_000_000), 37_060_000); // × 35% − 15,440,000
  assert.equal(estimateIncomeTax(1_500_000_000), 609_060_000); // × 45% − 65,940,000
});

test("구간 경계에서 세금이 끊기지 않고 이어진다", () => {
  for (const edge of [14_000_000, 50_000_000, 88_000_000, 150_000_000, 300_000_000, 500_000_000, 1_000_000_000]) {
    const diff = estimateIncomeTax(edge + 1) - estimateIncomeTax(edge);
    assert.ok(diff >= 0 && diff <= 1, `경계 ${edge}: 차이 ${diff}`);
  }
});

test("지방소득세 10% 포함, 이익이 0 이하면 세금 0", () => {
  assert.deepEqual(taxEstimate(50_000_000), {
    taxBase: 50_000_000,
    incomeTax: 6_240_000,
    localTax: 624_000,
    totalTax: 6_240_000 + 624_000,
    ratePct: 15,
  });
  assert.equal(taxEstimate(-1_000_000).totalTax, 0);
  assert.equal(taxEstimate(-1_000_000).taxBase, 0);
});

test("분납: 1천만원 이하는 없음, 2천만원 이하는 1천만원 넘는 부분, 그 이상은 절반", () => {
  assert.equal(incomeTaxInstallment(9_000_000), 0);
  assert.equal(incomeTaxInstallment(15_000_000), 5_000_000);
  assert.equal(incomeTaxInstallment(80_000_001), 40_000_000);
});

test("중간예납은 직전 해 소득세의 절반", () => {
  assert.equal(interimPrepayment(80_000_001), 40_000_000);
  assert.equal(interimPrepayment(-1), 0);
});
