import { test } from "node:test";
import assert from "node:assert/strict";
import { groupProjectProfit, totalProjectProfit, unbilledH2Profit, unsettledCreditPurchase } from "@/lib/projectProfit";
import type { CreditPayment } from "@/lib/types";

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

test("하반기 미발행 예상 이익: 상반기에 끊은 기성금은 상반기 결산에 있으니 빼서 두 번 안 잡음", () => {
  // 발주 5,000만 중 5월에 기성금 2,000만 → 하반기 몫은 3,000만 − 하반기 매입 800만 − 대행구매 200만
  assert.equal(unbilledH2Profit(50_000_000, 20_000_000, 8_000_000, 2_000_000), 20_000_000);
  // 상반기 기성금이 없으면 예전과 같음
  assert.equal(unbilledH2Profit(50_000_000, 0, 8_000_000, 2_000_000), 40_000_000);
});

test("외상 미정산 매입: 완납 전 외상만 거래 전체 금액(공급가)으로, 불공제 카테고리는 부가세 포함", () => {
  const tx = (id: string, payment_type: string, total: number, nonDeductible = false) => ({
    id,
    type: "매입",
    payment_type,
    sales_amount: 0,
    sales_vat: 0,
    purchase_amount: total,
    purchase_vat: 0,
    expense_categories: { name: nonDeductible ? "차량" : "자재", vat_non_deductible: nonDeductible },
  });
  const payment = (transaction_id: string, remaining_amount: number) =>
    ({ transaction_id, remaining_amount, paid_date: "2026-09-01", created_at: "2026-09-01T00:00:00Z" }) as CreditPayment;
  const rows = [
    tx("cash", "immediate", 1_100_000), // 즉시 결제 — 제외
    tx("open", "credit", 2_200_000), // 정산 이력 없음 — 공급가 2,000,000
    tx("partial", "credit", 1_100_000), // 일부만 갚음 — 완납 전이라 거래 전체 공급가 1,000,000
    tx("paid", "credit", 3_300_000), // 완납 — 이미 매입 합계에 들어가 있어 제외
    tx("car", "credit", 550_000, true), // 불공제 카테고리 — 총액 550,000
  ];
  const payments = [payment("partial", 600_000), payment("paid", 0)];
  assert.deepEqual(unsettledCreditPurchase(rows, payments), { count: 3, cost: 2_000_000 + 1_000_000 + 550_000 });
  assert.deepEqual(unsettledCreditPurchase([tx("cash", "immediate", 1_100_000)], []), { count: 0, cost: 0 });
});
