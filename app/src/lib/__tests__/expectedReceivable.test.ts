import { test } from "node:test";
import assert from "node:assert/strict";
import { receivedSalesByProject, remainingReceivable } from "@/lib/expectedReceivable";
import type { CreditPayment } from "@/lib/types";

const sale = (id: string, project_id: string, total: number, payment_type = "transfer") => ({
  id,
  project_id,
  type: "매출",
  payment_type,
  sales_amount: total,
  sales_vat: 0,
  purchase_amount: 0,
  purchase_vat: 0,
  expense_categories: null,
});
const settled = (transaction_id: string): CreditPayment => ({
  id: `p-${transaction_id}`,
  transaction_id,
  paid_date: "2026-09-01",
  paid_amount: 0,
  remaining_amount: 0,
  settlement_transaction_id: null,
  created_at: "2026-09-01T00:00:00Z",
});

// 발주액 1,000만 원(부가세 제외) 현장, 대행구매 없음
const QUOTE = 10_000_000;

test("기성금 계산서만 발행(외상, 정산 전)이면 아직 받은 게 아님", () => {
  const received = receivedSalesByProject([sale("s1", "A", 4_400_000, "credit")], []);
  assert.equal(remainingReceivable(QUOTE, 0, received.get("A") ?? 0), 10_000_000);
});

test("어음 할인 등으로 입금액이 달라도 정산 처리하면 계산서 금액(부가세 제외) 전체가 빠짐", () => {
  const rows = [sale("s1", "A", 4_400_000, "credit")];
  const received = receivedSalesByProject(rows, [settled("s1")]);
  assert.equal(received.get("A"), 4_000_000);
  assert.equal(remainingReceivable(QUOTE, 0, received.get("A")!), 6_000_000);
});

test("잔금까지 받으면 0원, 현금·이체 매출은 바로 받은 것으로", () => {
  const rows = [sale("s1", "A", 4_400_000, "credit"), sale("s2", "A", 6_600_000, "transfer")];
  const received = receivedSalesByProject(rows, [settled("s1")]);
  assert.equal(remainingReceivable(QUOTE, 0, received.get("A")!), 0);
});

test("대행구매액을 빼고, 계산서가 더 많아도 0 아래로 안 내려감", () => {
  assert.equal(remainingReceivable(QUOTE, 1_000_000, 0), 9_000_000);
  assert.equal(remainingReceivable(QUOTE, 1_000_000, 9_500_000), 0);
  assert.equal(remainingReceivable(null, 0, 0), 0);
});

test("프로젝트별로 따로 모으고 매입은 무시", () => {
  const rows = [
    sale("s1", "A", 1_100_000),
    sale("s2", "B", 2_200_000),
    { ...sale("s3", "A", 0), type: "매입", purchase_amount: 5_000_000 },
  ];
  const received = receivedSalesByProject(rows, []);
  assert.equal(received.get("A"), 1_000_000);
  assert.equal(received.get("B"), 2_000_000);
});
