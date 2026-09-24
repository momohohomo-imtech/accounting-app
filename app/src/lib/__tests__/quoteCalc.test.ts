import { test } from "node:test";
import assert from "node:assert/strict";
import { computeConfirmedAmount, quoteLineAmounts, splitVat } from "@/lib/quoteCalc";
import { numberToKorean, numberToKoreanAmount } from "@/lib/numberToKorean";

const line = (unit_price: number | null, quantity: number | null, amount: number | null, handling_fee_pct: number | null = 0) => ({
  unit_price,
  quantity,
  amount,
  handling_fee_pct,
});

test("핸들링 fee 반영 후 100원 단위 반올림", () => {
  assert.equal(computeConfirmedAmount(1_234, 0), 1_200);
  assert.equal(computeConfirmedAmount(45_670, 10), 50_200); // 50,237 → 50,200
  assert.equal(computeConfirmedAmount(150, 0), 200);
});

test("금액이 단가 × 수량인 줄: 금액 = (100원 단위) 단가 × 수량 — 인쇄된 단가×수량과 일치", () => {
  const cases = [
    [line(1_234, 3, 3_702), 1_200, 3_600],
    [line(45_670, 12, 548_040, 10), 50_200, 602_400],
    [line(128_000, 4, 512_000), 128_000, 512_000],
    [line(18_300, 2.5, 45_750, 10), 20_100, 50_250],
  ] as const;
  for (const [it, unit, confirmed] of cases) {
    const r = quoteLineAmounts(it);
    assert.equal(r.adjustedUnitPrice, unit);
    assert.equal(r.confirmed, confirmed);
    assert.equal(r.confirmed, r.adjustedUnitPrice! * it.quantity!);
  }
});

test("금액을 직접 고쳐 적은 줄(할인 등)은 적은 금액 기준", () => {
  const r = quoteLineAmounts(line(50_000, 3, 140_000, 10)); // 150,000이 아니라 140,000으로 할인
  assert.equal(r.confirmed, 154_000);
  assert.equal(r.adjustedUnitPrice, 55_000);
});

test("단가·수량 없이 금액만 있는 줄", () => {
  assert.deepEqual(quoteLineAmounts(line(null, null, 777_777, 0)), { adjustedUnitPrice: null, confirmed: 777_800 });
  assert.deepEqual(quoteLineAmounts(line(null, null, null, null)), { adjustedUnitPrice: null, confirmed: 0 });
});

test("부가세 포함 금액 분리: 공급가 + 세액 = 원금액", () => {
  assert.deepEqual(splitVat(1_100_000), { supply: 1_000_000, vat: 100_000 });
  const { supply, vat } = splitVat(12_345);
  assert.equal(supply + vat, 12_345);
});

test("금액 한글 표기", () => {
  assert.equal(numberToKorean(0), "영");
  assert.equal(numberToKorean(4_180_000), "사백십팔만");
  assert.equal(numberToKorean(10_000), "일만"); // 금액 표기는 "일만"(앞자리 1도 적음)
  assert.equal(numberToKorean(100_010_000), "일억일만");
  assert.equal(numberToKorean(1_234_567_890), "십이억삼천사백오십육만칠천팔백구십");
  assert.equal(numberToKoreanAmount(5_500_000), "일금 오백오십만원정");
});
