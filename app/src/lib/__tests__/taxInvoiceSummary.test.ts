import { test } from "node:test";
import assert from "node:assert/strict";
import { halfOf, taxInvoiceHalfSummary, type TaxInvoiceRow } from "@/lib/taxInvoiceSummary";

// 가짜 거래만
let n = 0;
const row = (p: Partial<TaxInvoiceRow> & { trans_date: string; type: string; amount: number; vat?: number }): TaxInvoiceRow => {
  const sales = p.type === "매출";
  return {
    id: `t${++n}`,
    type: p.type,
    trans_date: p.trans_date,
    tax_invoice_issued: p.tax_invoice_issued ?? true,
    payment_group_id: p.payment_group_id ?? null,
    sales_amount: sales ? p.amount : 0,
    sales_vat: sales ? p.vat ?? 0 : 0,
    purchase_amount: sales ? 0 : p.amount,
    purchase_vat: sales ? 0 : p.vat ?? 0,
  };
};

test("반기: 1~6월 상반기, 7~12월 하반기", () => {
  assert.equal(halfOf("2026-01-01"), "h1");
  assert.equal(halfOf("2026-06-30"), "h1");
  assert.equal(halfOf("2026-07-01"), "h2");
  assert.equal(halfOf("2026-12-31"), "h2");
});

test("세금계산서 발행한 것만, 반기·매입/매출별 건수와 합계(공급가액 + 부가세)", () => {
  const s = taxInvoiceHalfSummary([
    row({ type: "매입", trans_date: "2026-03-05", amount: 100000, vat: 10000 }),
    row({ type: "매입", trans_date: "2026-06-30", amount: 50000, vat: 5000 }),
    row({ type: "매입", trans_date: "2026-04-01", amount: 999999, tax_invoice_issued: false }),
    row({ type: "매출", trans_date: "2026-05-10", amount: 2000000, vat: 200000 }),
    row({ type: "매입", trans_date: "2026-07-01", amount: 30000, vat: 3000 }),
    row({ type: "매출", trans_date: "2026-11-20", amount: 1000000, vat: 100000 }),
    row({ type: "매출", trans_date: "2026-12-31", amount: 500000, vat: 50000 }),
  ]);
  assert.deepEqual(s.h1, { purchase: { count: 2, amount: 165000 }, sales: { count: 1, amount: 2200000 } });
  assert.deepEqual(s.h2, { purchase: { count: 1, amount: 33000 }, sales: { count: 2, amount: 1650000 } });
});

test("한 결제로 묶은 줄은 한 건(금액은 줄마다 다 더함), 마이너스 줄도 금액에 그대로", () => {
  const s = taxInvoiceHalfSummary([
    row({ type: "매입", trans_date: "2026-02-10", amount: 60000, vat: 6000, payment_group_id: "g1" }),
    row({ type: "매입", trans_date: "2026-02-10", amount: 40000, vat: 4000, payment_group_id: "g1" }),
    row({ type: "매입", trans_date: "2026-02-10", amount: -1000, vat: -100, payment_group_id: "g1" }),
    row({ type: "매입", trans_date: "2026-02-11", amount: 10000, vat: 1000 }),
  ]);
  assert.deepEqual(s.h1.purchase, { count: 2, amount: 119900 });
  assert.deepEqual(s.h2, { purchase: { count: 0, amount: 0 }, sales: { count: 0, amount: 0 } });
});

test("자료가 없으면 모두 0건 0원", () => {
  const s = taxInvoiceHalfSummary([]);
  assert.deepEqual(s, {
    h1: { purchase: { count: 0, amount: 0 }, sales: { count: 0, amount: 0 } },
    h2: { purchase: { count: 0, amount: 0 }, sales: { count: 0, amount: 0 } },
  });
});
