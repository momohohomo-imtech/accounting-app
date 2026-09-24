import { test } from "node:test";
import assert from "node:assert/strict";
import { isVatExemptCategory, supplyOf, vatOf, salesSupplyOf, purchaseCostOf } from "@/lib/vatBasis";

const sale = (total: number, category?: { name: string; vat_exempt?: boolean | null; vat_non_deductible?: boolean | null }) => ({
  type: "매출",
  sales_amount: total,
  sales_vat: 0,
  purchase_amount: 0,
  purchase_vat: 0,
  expense_categories: category ?? null,
});
const purchase = (supply: number, vat: number, category?: { name: string; vat_exempt?: boolean | null; vat_non_deductible?: boolean | null }) => ({
  type: "매입",
  sales_amount: 0,
  sales_vat: 0,
  purchase_amount: supply,
  purchase_vat: vat,
  expense_categories: category ?? null,
});

test("총액은 부가세 포함으로 보고 ÷1.1로 공급가·부가세를 나눈다", () => {
  const row = purchase(1_000_000, 100_000);
  assert.equal(supplyOf(row), 1_000_000);
  assert.equal(vatOf(row), 100_000);
});

test("공급가·부가세 칸에 어떻게 나눠 저장됐는지와 상관없이 총액 기준", () => {
  // VAT 체크 없이 총액 1,100,000을 공급가 칸에 전부 넣은 경우도 같은 결과
  const row = purchase(1_100_000, 0);
  assert.equal(supplyOf(row), 1_000_000);
  assert.equal(vatOf(row), 100_000);
});

test("반올림: 공급가 + 부가세 = 총액이 항상 맞는다", () => {
  for (const total of [1, 10, 11, 12_345, 999_999, 1_234_567_891]) {
    const row = purchase(total, 0);
    assert.equal(supplyOf(row) + vatOf(row), total);
  }
  assert.equal(supplyOf(purchase(12_345, 0)), 11_223); // 12,345 ÷ 1.1 = 11,222.7…
});

test("비과세 카테고리는 총액 전체가 공급가, 부가세 0", () => {
  const row = purchase(3_000_000, 0, { name: "인건비", vat_exempt: true });
  assert.equal(supplyOf(row), 3_000_000);
  assert.equal(vatOf(row), 0);
});

test("비과세 판단은 카테고리 체크 우선, 칸이 없을 때만 이름으로", () => {
  assert.equal(isVatExemptCategory({ name: "인건비", vat_exempt: false }), false); // 체크를 끄면 이름과 상관없이 과세
  assert.equal(isVatExemptCategory({ name: "자재비", vat_exempt: true }), true);
  assert.equal(isVatExemptCategory({ name: "인건비" }), true); // 083 SQL 실행 전(칸 없음)
  assert.equal(isVatExemptCategory({ name: "직원급여/상여/4대보험" }), true);
  assert.equal(isVatExemptCategory({ name: "자재비" }), false);
  assert.equal(isVatExemptCategory(null), false);
});

test("카테고리 관계가 배열로 와도 첫 번째로 판단", () => {
  const row = { ...purchase(500_000, 0), expense_categories: [{ name: "면세", vat_exempt: true }] };
  assert.equal(supplyOf(row), 500_000);
});

test("이익 계산용 매입 비용: 일반은 공급가, 매입세액 불공제는 총액 전체", () => {
  assert.equal(purchaseCostOf(purchase(1_000_000, 100_000)), 1_000_000);
  assert.equal(purchaseCostOf(purchase(1_000_000, 100_000, { name: "유류비", vat_non_deductible: true })), 1_100_000);
  assert.equal(purchaseCostOf(sale(1_100_000)), 0);
});

test("매출 공급가는 매출에만", () => {
  assert.equal(salesSupplyOf(sale(1_100_000)), 1_000_000);
  assert.equal(salesSupplyOf(purchase(1_000_000, 100_000)), 0);
});
