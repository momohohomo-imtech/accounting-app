import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VAT_PERIODS,
  categoryExpenseRows,
  clientInvoiceRows,
  creditAsOf,
  creditBalanceRows,
  incomeSummary,
  invoicePeriodRows,
  monthlyRows,
  noticeFor,
  nonInvoicePurchaseByMethod,
  vatPeriodRows,
  type TaxCategory,
  type TaxReviewTx,
} from "@/lib/taxReview";

// 가짜 자료만 — 총액은 부가세 포함으로 보고 공급가액 = 총액 ÷ 1.1(lib/vatBasis)
const CATS: TaxCategory[] = [
  { id: "cat-mat", name: "가짜 자재", vat_exempt: false, vat_non_deductible: false },
  { id: "cat-car", name: "가짜 차량", vat_exempt: false, vat_non_deductible: true },
  { id: "cat-pay", name: "가짜 인건비", vat_exempt: true, vat_non_deductible: false },
];
const CLIENTS = [
  { id: "c1", name: "가짜 원청" },
  { id: "c2", name: "가짜 자재상" },
];
const METHODS = [
  { id: "pm-card", name: "가짜 카드" },
  { id: "pm-send", name: "송금" },
];
let n = 0;
function tx(p: Partial<TaxReviewTx> & { type: string; trans_date: string; total: number }): TaxReviewTx {
  const sales = p.type === "매출";
  return {
    id: p.id ?? `t${++n}`,
    type: p.type,
    trans_date: p.trans_date,
    client_id: p.client_id ?? null,
    client_name_raw: p.client_name_raw ?? null,
    category_id: p.category_id ?? null,
    payment_method_id: p.payment_method_id ?? null,
    payment_type: p.payment_type ?? "immediate",
    tax_invoice_issued: p.tax_invoice_issued ?? false,
    payment_group_id: p.payment_group_id ?? null,
    sales_amount: sales ? p.total : 0,
    sales_vat: 0,
    purchase_amount: sales ? 0 : p.total,
    purchase_vat: 0,
  };
}

const ROWS: TaxReviewTx[] = [
  tx({ type: "매출", trans_date: "2026-02-10", total: 11000000, client_id: "c1", tax_invoice_issued: true }),
  tx({ type: "매출", trans_date: "2026-08-10", total: 5500000, client_id: "c1", tax_invoice_issued: true }),
  tx({ type: "매출", trans_date: "2026-09-01", total: 110000, client_name_raw: "가짜 개인 고객" }),
  tx({ type: "매입", trans_date: "2026-03-05", total: 1100000, client_id: "c2", category_id: "cat-mat", tax_invoice_issued: true, payment_group_id: "g1" }),
  tx({ type: "매입", trans_date: "2026-03-05", total: 550000, client_id: "c2", category_id: "cat-mat", tax_invoice_issued: true, payment_group_id: "g1" }),
  tx({ type: "매입", trans_date: "2026-04-20", total: 330000, category_id: "cat-car", payment_method_id: "pm-card" }),
  tx({ type: "매입", trans_date: "2026-05-20", total: 2000000, category_id: "cat-pay", payment_method_id: "pm-send" }),
  tx({ type: "매입", trans_date: "2026-10-02", total: 220000, category_id: "cat-mat", payment_method_id: "pm-card" }),
  tx({ type: "매입", trans_date: "2026-11-15", total: 110000 }),
];

test("부가세 기간: 분기·1기·2기·연간 순서, 매출세액 − 공제 매입세액(불공제·비과세 빼고) = 예상 납부세액", () => {
  const rows = vatPeriodRows(ROWS, CATS);
  assert.deepEqual(rows.map((r) => r.key), VAT_PERIODS.map((p) => p.key));
  const h1 = rows.find((r) => r.key === "h1")!;
  assert.equal(h1.salesSupply, 10000000);
  assert.equal(h1.salesVat, 1000000);
  // 매입: 자재 1,650,000(공급 1,500,000·세액 150,000), 차량(불공제) 330,000(공급 300,000·세액 30,000), 인건비(비과세) 2,000,000
  assert.equal(h1.purchaseSupply, 1500000 + 300000 + 2000000);
  assert.equal(h1.deductibleVat, 150000);
  assert.equal(h1.nonDeductibleVat, 30000);
  assert.equal(h1.exemptPurchase, 2000000);
  assert.equal(h1.net, 1000000 - 150000);
  const year = rows.find((r) => r.key === "year")!;
  const q = (k: string) => rows.find((r) => r.key === k)!;
  assert.equal(year.net, q("h1").net + q("h2").net, "연간 = 1기 + 2기");
  assert.equal(q("h1").salesVat, q("q1").salesVat + q("q2").salesVat, "1기 = 1분기 + 2분기");
  assert.equal(q("h2").deductibleVat, 20000 + 10000);
});

test("세금계산서 발행·수취: 체크한 거래만, 한 결제 묶음은 한 건", () => {
  const rows = invoicePeriodRows(ROWS, CATS);
  const h1 = rows.find((r) => r.key === "h1")!;
  assert.deepEqual(h1.sales, { count: 1, supply: 10000000, vat: 1000000 });
  assert.deepEqual(h1.purchase, { count: 1, supply: 1500000, vat: 150000 }, "묶음 두 줄 = 한 건");
  const h2 = rows.find((r) => r.key === "h2")!;
  assert.deepEqual(h2.sales, { count: 1, supply: 5000000, vat: 500000 });
  assert.deepEqual(h2.purchase, { count: 0, supply: 0, vat: 0 });
});

test("세금계산서 없는 과세 매입 — 결제수단별(비과세 빼고, 결제수단 없음 따로), 큰 순", () => {
  const rows = nonInvoicePurchaseByMethod(ROWS, CATS, METHODS);
  assert.deepEqual(
    rows.map((r) => [r.name, r.h1.supply, r.h2.supply, r.year.count]),
    [
      ["가짜 카드", 300000, 200000, 2],
      ["(결제수단 없음)", 0, 100000, 1],
    ]
  );
});

test("거래처별 세금계산서: 매출처·매입처 따로, 반기별·연간", () => {
  const sales = clientInvoiceRows(ROWS, CATS, CLIENTS, "매출");
  assert.deepEqual(sales.map((r) => [r.name, r.h1.supply, r.h2.supply, r.year.count]), [["가짜 원청", 10000000, 5000000, 2]]);
  const purchase = clientInvoiceRows(ROWS, CATS, CLIENTS, "매입");
  assert.deepEqual(purchase.map((r) => [r.name, r.year.supply, r.year.vat, r.year.count]), [["가짜 자재상", 1500000, 150000, 1]]);
});

test("카테고리별 경비: 비용 = 공급가액(불공제는 총액, 비과세는 총액), 비고, 카테고리 없음 따로", () => {
  const rows = categoryExpenseRows(ROWS, CATS);
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(by["가짜 인건비"].cost, 2000000);
  assert.equal(by["가짜 인건비"].note, "비과세");
  assert.equal(by["가짜 차량"].cost, 330000);
  assert.equal(by["가짜 차량"].note, "불공제");
  assert.equal(by["가짜 자재"].cost, 1500000 + 200000);
  assert.equal(by["가짜 자재"].count, 2, "묶음 한 건 + 10월 한 건");
  assert.equal(by["(카테고리 없음)"].cost, 100000);
  assert.equal(rows[0].name, "가짜 인건비", "비용 큰 순");
  const s = incomeSummary(ROWS, CATS);
  assert.equal(s.sales, 10000000 + 5000000 + 100000);
  assert.equal(s.cost, rows.reduce((a, r) => a + r.cost, 0));
  assert.equal(s.profit, s.sales - s.cost);
});

test("월별: 12달, 세금계산서 건수는 묶음 한 건", () => {
  const rows = monthlyRows(ROWS, CATS);
  assert.equal(rows.length, 12);
  assert.equal(rows[2].purchaseSupply, 1500000);
  assert.equal(rows[2].invoicePurchaseCount, 1);
  assert.equal(rows[1].invoiceSalesCount, 1);
  assert.equal(rows[0].salesSupply, 0);
});

test("외상 잔액: 기준일까지의 정산만, 0원은 빼고, 마이너스 잔액도 그대로, 거래처·구분별", () => {
  const credit = [
    tx({ id: "k1", type: "매출", trans_date: "2026-06-01", total: 3300000, client_id: "c1", payment_type: "credit" }),
    tx({ id: "k2", type: "매출", trans_date: "2026-09-01", total: 1100000, client_id: "c1", payment_type: "credit" }),
    tx({ id: "k3", type: "매입", trans_date: "2026-10-01", total: 550000, client_id: "c2", payment_type: "credit" }),
    tx({ id: "k4", type: "매입", trans_date: "2026-10-05", total: -11000, client_id: "c2", payment_type: "credit" }),
    tx({ id: "k5", type: "매출", trans_date: "2027-01-05", total: 999, client_id: "c1", payment_type: "credit" }),
  ];
  const payments = [
    { transaction_id: "k1", paid_date: "2026-07-01", remaining_amount: 1300000, created_at: "2026-07-01T00:00:00Z" },
    { transaction_id: "k1", paid_date: "2027-01-10", remaining_amount: 0, created_at: "2027-01-10T00:00:00Z" },
    { transaction_id: "k3", paid_date: "2026-11-01", remaining_amount: 0, created_at: "2026-11-01T00:00:00Z" },
  ];
  const rows = creditBalanceRows(credit, payments, "2026-12-31", CLIENTS);
  assert.deepEqual(
    rows.map((r) => [r.side, r.name, r.balance, r.open, r.oldest]),
    [
      ["외상매입금", "가짜 자재상", -11000, 1, "2026-10-05"],
      ["외상매출금", "가짜 원청", 1300000 + 1100000, 2, "2026-06-01"],
    ]
  );
  assert.equal(creditAsOf(2026, "2026-11-26"), "2026-11-26");
  assert.equal(creditAsOf(2025, "2026-11-26"), "2025-12-31");
});

test("예정고지액: 1기 줄은 4월분, 2기 줄은 10월분, 나머지는 없음", () => {
  const notices = [
    { month: 4, amount: 500000 },
    { month: 10, amount: 700000 },
  ];
  assert.equal(noticeFor(notices, "h1"), 500000);
  assert.equal(noticeFor(notices, "h2"), 700000);
  assert.equal(noticeFor(notices, "q1"), null);
  assert.equal(noticeFor([], "h1"), null);
});
