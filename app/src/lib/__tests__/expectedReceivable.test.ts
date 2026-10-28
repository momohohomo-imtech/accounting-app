import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billedSalesByProject,
  expectedReceivableByStatus,
  projectReceipts,
  RECEIVABLE_STATUSES,
  receivableOf,
  receivedSalesByProject,
  remainingReceivable,
} from "@/lib/expectedReceivable";
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

test("수금 예정액: 어미 + 귀속 하위는 한 묶음 — 하위 발주액은 더하고 하위로 받은 기성금은 빼서 어미 상태 칸에 한 건", () => {
  const projects = [
    { id: "P", name: "진행중 어미", status: "ongoing", quote_amount: 10_000_000 },
    { id: "C", name: "귀속 하위", status: "merged", quote_amount: 5_000_000, parent_project_id: "P" },
    { id: "D", name: "공사 완료 단독", status: "done", quote_amount: 3_000_000 },
    { id: "X", name: "수금 완료 어미", status: "collected", quote_amount: 8_000_000 },
    { id: "XC", name: "그 귀속 하위", status: "merged", quote_amount: 1_000_000, parent_project_id: "X" },
    { id: "O", name: "다른 해 어미의 하위", status: "merged", quote_amount: 2_000_000, parent_project_id: "다른 해" },
  ];
  const received = receivedSalesByProject([sale("s1", "C", 11_000_000)], []);
  const rows = expectedReceivableByStatus(
    projects,
    ["ongoing", "done", "done_awaiting_payment"],
    new Map([["P", 1_000_000]]),
    received
  );
  // 진행중 묶음: (1,000만 + 500만) − 대행구매 100만 − 하위 기성금 1,000만 = 400만
  assert.deepEqual(rows, [
    { status: "ongoing", count: 1, amount: 4_000_000, received: 10_000_000 },
    { status: "done", count: 1, amount: 3_000_000, received: 0 },
    { status: "done_awaiting_payment", count: 0, amount: 0, received: 0 },
  ]);
});

test("수금 예정액: 자기 상태가 있는 하위는 자기 상태 칸에 따로(프로젝트 목록과 같게), 귀속 하위만 어미 칸에", () => {
  const projects = [
    { id: "P", name: "진행중 어미", status: "ongoing", quote_amount: 10_000_000 },
    { id: "M", name: "귀속 하위", status: "merged", quote_amount: 2_000_000, parent_project_id: "P" },
    { id: "W", name: "수금대기 하위", status: "done_awaiting_payment", quote_amount: 3_000_000, parent_project_id: "P" },
  ];
  const received = receivedSalesByProject([sale("s2", "W", 1_100_000)], []);
  const rows = expectedReceivableByStatus(projects, ["ongoing", "done", "done_awaiting_payment"], new Map(), received);
  // 진행중: 어미 1,000만 + 귀속 하위 200만 / 수금 대기: 하위 300만 − 받은 100만(예전엔 진행중 칸에 합쳐졌음)
  assert.deepEqual(rows, [
    { status: "ongoing", count: 1, amount: 12_000_000, received: 0 },
    { status: "done", count: 0, amount: 0, received: 0 },
    { status: "done_awaiting_payment", count: 1, amount: 2_000_000, received: 1_000_000 },
  ]);
});

test("프로젝트 받은 돈: 계산서마다 입금 상태, 미수 금액은 대시보드 수금 예정액과 같은 계산", () => {
  const on = (date: string, row: ReturnType<typeof sale>) => ({ ...row, trans_date: date });
  const pay = (transaction_id: string, paid_date: string, paid_amount: number, remaining_amount: number): CreditPayment => ({
    id: `p-${transaction_id}-${paid_date}`,
    transaction_id,
    paid_date,
    paid_amount,
    remaining_amount,
    settlement_transaction_id: null,
    created_at: `${paid_date}T00:00:00Z`,
  });
  const rows = [
    on("2026-03-02", sale("advance", "P", 3_300_000)), // 선급금 — 계산서와 같은 날 입금
    on("2026-05-31", sale("mid1", "P", 3_300_000, "credit")), // 1차 중도금 — 외상, 6/10 다 받음
    on("2026-08-31", sale("mid2", "P", 2_200_000, "credit")), // 2차 중도금 — 외상, 일부만 받음
    { ...on("2026-04-01", sale("buy", "P", 999_000)), type: "매입" }, // 매입은 빼고
  ];
  const payments = [pay("mid1", "2026-06-10", 3_300_000, 0), pay("mid2", "2026-09-15", 1_000_000, 1_200_000)];
  const r = projectReceipts(rows, payments, 10_000_000, 1_000_000);
  assert.deepEqual(
    r.lines.map((l) => [l.row.id, l.status, l.received, l.paidDate]),
    [
      ["advance", "received", 3_300_000, "2026-03-02"],
      ["mid1", "received", 3_300_000, "2026-06-10"],
      ["mid2", "partial", 1_000_000, "2026-09-15"],
    ]
  );
  // 받은 금액 600만(일부 입금은 다 받을 때까지 빼지 않음), 실제 입금 760만(부가세 포함)
  assert.deepEqual(
    { expected: r.expected, billed: r.billed, received: r.received, actual: r.receivedActual },
    { expected: 9_000_000, billed: 8_000_000, received: 6_000_000, actual: 7_600_000 }
  );
  // 미수 금액 = 수주예상액 900만 − 받은 금액 600만 = 300만 = 입금 대기 200만 + 계산서 미발행 100만
  const project = [{ id: "P", name: "가짜 현장", status: "ongoing", quote_amount: 10_000_000 }];
  const agency = new Map([["P", 1_000_000]]);
  const received = receivedSalesByProject(rows, payments);
  assert.deepEqual(receivableOf(project, agency, received, billedSalesByProject(rows)), {
    amount: 3_000_000,
    waiting: 2_000_000,
    unbilled: 1_000_000,
    count: 1,
    quote: 10_000_000,
  });
  // 대시보드 수금 예정액과 같은 숫자
  assert.equal(expectedReceivableByStatus(project, ["ongoing"], agency, received)[0].amount, 3_000_000);
});

test("미수 금액: 입금 전 외상은 입금 대기, 발주액보다 더 끊어도 0 아래로 안 내려감", () => {
  const rows = [{ ...sale("only", "P", 12_100_000, "credit"), trans_date: "2026-10-01" }];
  const r = projectReceipts(rows, [], 10_000_000, 0);
  assert.equal(r.lines[0].status, "waiting");
  assert.equal(r.lines[0].paidDate, null);
  assert.equal(r.lines[0].received, 0);
  assert.equal(r.billed, 11_000_000);
  const m = receivableOf(
    [{ id: "P", status: "done", quote_amount: 10_000_000 }],
    new Map(),
    receivedSalesByProject(rows, []),
    billedSalesByProject(rows)
  );
  assert.deepEqual(m, { amount: 10_000_000, waiting: 11_000_000, unbilled: 0, count: 1, quote: 10_000_000 });
});

test("미수 금액: 검토중·수금 완료·귀속 하위 하나만이면 없음(null), 묶음은 대시보드처럼 단위마다 더함", () => {
  const none = new Map<string, number>();
  assert.equal(receivableOf([{ id: "R", status: "review", quote_amount: 5_000_000 }], none, none), null);
  assert.equal(receivableOf([{ id: "C", status: "collected", quote_amount: 5_000_000 }], none, none), null);
  assert.equal(receivableOf([{ id: "M", status: "merged", quote_amount: 0, parent_project_id: "X" }], none, none), null);
  // 진행중 어미(1,000만) + 귀속 하위(하위로 600만 받음) + 수금대기 하위(300만 중 100만 받음) + 수금 완료 하위(빠짐)
  const group = [
    { id: "P", status: "ongoing", quote_amount: 10_000_000 },
    { id: "M", status: "merged", quote_amount: 0, parent_project_id: "P" },
    { id: "W", status: "done_awaiting_payment", quote_amount: 3_000_000, parent_project_id: "P" },
    { id: "D", status: "collected", quote_amount: 2_000_000, parent_project_id: "P" },
  ];
  const received = new Map([
    ["M", 6_000_000],
    ["W", 1_000_000],
    ["D", 2_000_000],
  ]);
  const m = receivableOf(group, none, received);
  assert.equal(m?.amount, 4_000_000 + 2_000_000);
  assert.equal(m?.count, 2);
  const dash = expectedReceivableByStatus(group, RECEIVABLE_STATUSES, none, received);
  assert.equal(dash.reduce((s, r) => s + r.amount, 0), m?.amount);
});
