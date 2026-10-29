import { test } from "node:test";
import assert from "node:assert/strict";
import { listTotals, listUnits, unitAmounts } from "@/lib/projectListTotals";

// 가짜 프로젝트 — 금액은 모두 부가세 제외
const p = (id: string, status: string, quote_amount: number | null, parent_project_id: string | null = null) => ({
  id,
  name: `프로젝트 ${id}`,
  status,
  quote_amount,
  parent_project_id,
});

const A = p("A", "ongoing", 10_000_000);
const B = p("B", "done_awaiting_payment", 20_000_000);
const B1 = p("B1", "merged", null, "B");
const C = p("C", "review", 5_000_000);
const D = p("D", "ongoing", null);

const purchase = new Map([
  ["A", 6_000_000],
  ["B", 12_000_000],
  ["B1", 2_000_000],
  ["C", 1_000_000],
  ["D", 500_000],
]);
const agency = new Map([
  ["A", 1_000_000],
  ["D", 100_000],
]);
const received = new Map([
  ["A", 4_000_000],
  ["B1", 5_000_000],
]);

test("계산 단위: 귀속 묶음은 어미를 맨 앞으로 한 단위, 아니면 프로젝트 하나", () => {
  const units = listUnits([B1, A, B, C], new Map([["B1", "B"]]));
  assert.deepEqual(
    units.map((u) => u.map((m) => m.id)),
    [["B", "B1"], ["A"], ["C"]]
  );
  // 어미가 목록에 없으면(다른 해 등) 하위끼리 한 단위, 맨 앞은 첫 줄
  assert.deepEqual(
    listUnits([B1], new Map([["B1", "B"]])).map((u) => u.map((m) => m.id)),
    [["B1"]]
  );
});

test("단위 금액: 묶음은 하위 매입·받은 돈까지 합침(하위로 받은 기성금도 어미 발주액에서 빠짐)", () => {
  assert.deepEqual(unitAmounts([B, B1], purchase, agency, received), {
    quote: 20_000_000,
    agency: 0,
    purchase: 14_000_000,
    profit: 6_000_000,
    rate: 30,
    received: 5_000_000,
    receivable: 15_000_000,
  });
  // 검토중은 받을 금액 없음("-"), 발주액이 없으면 이익금·미수 금액 없음
  assert.equal(unitAmounts([C], purchase, agency, received).receivable, null);
  const d = unitAmounts([D], purchase, agency, received);
  assert.equal(d.profit, null);
  assert.equal(d.receivable, null);
});

test("합계: 목록 하단 합계와 같은 기준 — 발주액 없는 단위의 매입은 이익금에서 빠지고 따로 알려 줌", () => {
  const units = listUnits([A, B, B1, C, D], new Map([["B1", "B"]]));
  const t = listTotals(units, purchase, agency, received);
  assert.equal(t.quote, 35_000_000);
  assert.equal(t.agency, 1_100_000);
  assert.equal(t.contractExpected, 33_900_000);
  assert.equal(t.purchase, 21_500_000);
  // A 300만 + B묶음 600만 + C 400만(D는 발주액 없음)
  assert.equal(t.profit, 13_000_000);
  assert.equal(t.rate?.toFixed(2), "37.14");
  assert.equal(t.received, 9_000_000);
  // A 1,000만 − 100만 − 400만 = 500만, B묶음 2,000만 − 500만 = 1,500만
  assert.equal(t.receivable, 20_000_000);
  assert.equal(t.noQuoteCount, 1);
  assert.equal(t.noQuoteCost, 600_000);
});

test("합계: 자기 상태가 있는 하위는 미수 금액만 따로 셈(이익금은 묶음 그대로)", () => {
  const P = p("P", "ongoing", 10_000_000);
  const Q = p("Q", "done_awaiting_payment", 4_000_000, "P");
  const t = listTotals(listUnits([P, Q], new Map([["Q", "P"]])), new Map([["Q", 1_000_000]]), new Map(), new Map([["Q", 4_000_000]]));
  assert.equal(t.profit, 13_000_000);
  // P 1,000만(받은 것 없음) + Q 400만 − 400만 = 0
  assert.equal(t.receivable, 10_000_000);
  // 빈 목록
  assert.deepEqual(listTotals([], purchase, agency, received), {
    quote: 0,
    agency: 0,
    contractExpected: 0,
    purchase: 0,
    profit: 0,
    rate: null,
    received: 0,
    receivable: 0,
    noQuoteCount: 0,
    noQuoteCost: 0,
  });
});
