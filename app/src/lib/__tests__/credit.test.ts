import { test } from "node:test";
import assert from "node:assert/strict";
import { transactionTotal, remainingBalance, isCreditSettled, isLedgerVisible } from "@/lib/credit";
import type { CreditPayment } from "@/lib/types";

const tx = (id: string, payment_type = "credit") => ({
  id,
  type: "매출",
  payment_type,
  sales_amount: 1_000_000,
  sales_vat: 100_000,
  purchase_amount: 0,
  purchase_vat: 0,
});
const pay = (transaction_id: string, paid_date: string, remaining_amount: number, created_at = "2026-01-01T00:00:00Z"): CreditPayment => ({
  id: `${transaction_id}-${paid_date}-${created_at}`,
  transaction_id,
  paid_date,
  paid_amount: 0,
  remaining_amount,
  settlement_transaction_id: null,
  created_at,
});

test("거래 총액 = 공급가 + 부가세 (매출/매입 구분)", () => {
  assert.equal(transactionTotal(tx("a")), 1_100_000);
  assert.equal(
    transactionTotal({ type: "매입", sales_amount: 9, sales_vat: 9, purchase_amount: 200, purchase_vat: 20 }),
    220
  );
});

test("정산 이력이 없으면 잔액 = 총액, 장부에서 빠짐", () => {
  assert.equal(remainingBalance(tx("a"), []), 1_100_000);
  assert.equal(isCreditSettled(tx("a"), []), false);
  assert.equal(isLedgerVisible(tx("a"), []), false);
});

test("잔액은 가장 마지막 정산 이력(정산일 → 등록시각 순) 기준", () => {
  const payments = [
    pay("a", "2026-03-01", 0),
    pay("a", "2026-01-01", 500_000), // 등록은 뒤에 했지만 정산일이 더 이름
    pay("b", "2026-02-01", 300_000, "2026-02-01T09:00:00Z"),
    pay("b", "2026-02-01", 100_000, "2026-02-01T10:00:00Z"), // 같은 날이면 나중에 등록한 것
  ];
  assert.equal(remainingBalance(tx("a"), payments), 0);
  assert.equal(isCreditSettled(tx("a"), payments), true);
  assert.equal(remainingBalance(tx("b"), payments), 100_000);
  assert.equal(isCreditSettled(tx("b"), payments), false);
});

test("완납된 외상만 장부에 들어가고, 현금·이체는 항상 장부에", () => {
  const payments = [pay("a", "2026-03-01", 0)];
  assert.equal(isLedgerVisible(tx("a"), payments), true);
  assert.equal(isLedgerVisible(tx("c"), payments), false);
  assert.equal(isLedgerVisible(tx("d", "transfer"), []), true);
  assert.equal(isLedgerVisible(tx("e", "cash"), []), true);
});

test("다른 정산 이력 배열이면 결과도 따로(색인 재사용이 섞이지 않음)", () => {
  const first = [pay("a", "2026-01-01", 700_000)];
  const second = [pay("a", "2026-01-01", 0)];
  assert.equal(remainingBalance(tx("a"), first), 700_000);
  assert.equal(remainingBalance(tx("a"), second), 0);
  assert.equal(remainingBalance(tx("a"), first), 700_000);
});
