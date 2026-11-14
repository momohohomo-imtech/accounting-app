import { test } from "node:test";
import assert from "node:assert/strict";
import { addedVat, isVatExemptCategory, roundWon, supplyOf, vatOf, salesSupplyOf, purchaseCostOf } from "@/lib/vatBasis";

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

test("마이너스 금액(단수 조정·할인 줄, 11/14): 반올림·부가세가 플러스와 대칭, 플러스는 예전과 같음", () => {
  // 원 단위 반올림 — .5는 0에서 먼 쪽으로(플러스는 Math.round와 같음)
  assert.equal(roundWon(10.5), 11);
  assert.equal(roundWon(-10.5), -11);
  assert.equal(roundWon(-10.4), -10);
  assert.equal(roundWon(12.49), Math.round(12.49));
  // "부가세 별도" 체크 때 얹는 부가세
  assert.equal(addedVat(105), 11);
  assert.equal(addedVat(-105), -11);
  assert.equal(addedVat(-7), -1);
  assert.equal(addedVat(0), 0);
  // 공급가·부가세 나누기 — 마이너스 줄은 같은 금액 플러스 줄의 정확히 반대(합치면 0)
  const row = (total: number) => ({ type: "매입", purchase_amount: total, purchase_vat: 0, sales_amount: 0, sales_vat: 0 });
  for (const total of [11, 1_100, 5_005, 7, 116, 1_234_567]) {
    assert.equal(supplyOf(row(-total)), -supplyOf(row(total)), `공급가 ${total}`);
    assert.equal(vatOf(row(-total)), -vatOf(row(total)), `부가세 ${total}`);
    assert.equal(purchaseCostOf(row(total)) + purchaseCostOf(row(-total)), 0);
  }
  // 플러스 금액은 예전 계산(Math.round(총액 ÷ 1.1))과 같음 — 지금까지의 숫자는 안 바뀜
  for (const total of [1, 5, 16, 116, 5_005, 99_999, 1_234_567]) {
    assert.equal(supplyOf(row(total)), Math.round(total / 1.1));
  }
});

