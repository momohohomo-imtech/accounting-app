import { test } from "node:test";
import assert from "node:assert/strict";
import { groupProjectProfit, totalProjectProfit } from "@/lib/projectProfit";

// 어미 A(발주 2,000만) + 귀속 하위 B(발주 없음) + 귀속 하위 C(발주 500만), 별개 프로젝트 D(발주 없음)
const A = { id: "A", quote_amount: 20_000_000 };
const B = { id: "B", quote_amount: null };
const C = { id: "C", quote_amount: 5_000_000 };
const D = { id: "D", quote_amount: null };
const purchase = new Map([
  ["A", 4_000_000],
  ["B", 1_000_000],
  ["C", 500_000],
  ["D", 300_000],
]);
const agency = new Map([["A", 2_000_000]]);

test("귀속 하위의 발주액·매입·대행구매를 어미에 합산 (손익보고서와 같은 기준)", () => {
  const r = groupProjectProfit([A, B, C], purchase, agency);
  assert.equal(r.quote, 25_000_000);
  assert.equal(r.purchase, 5_500_000);
  assert.equal(r.agency, 2_000_000);
  assert.equal(r.profit, 17_500_000);
  assert.equal(r.rate, 70);
});

test("하위 없이 단독이면 자기 금액만, 발주액이 없으면 이익금·이익율 없음", () => {
  assert.equal(groupProjectProfit([A], purchase, agency).profit, 14_000_000);
  const none = groupProjectProfit([D], purchase, agency);
  assert.equal(none.profit, null);
  assert.equal(none.rate, null);
  assert.equal(none.purchase, 300_000);
});

test("이익 총합은 발주액 없는 프로젝트의 비용까지 뺀다", () => {
  // 25,000,000 − (4,000,000 + 1,000,000 + 500,000 + 300,000) − 2,000,000
  assert.equal(totalProjectProfit([A, B, C, D], purchase, agency), 17_200_000);
});

test("어미별로 합산한 이익의 합 + 발주액 없는 단독 프로젝트 비용 = 이익 총합", () => {
  const grouped = groupProjectProfit([A, B, C], purchase, agency).profit! - (purchase.get("D") ?? 0);
  assert.equal(grouped, totalProjectProfit([A, B, C, D], purchase, agency));
});
