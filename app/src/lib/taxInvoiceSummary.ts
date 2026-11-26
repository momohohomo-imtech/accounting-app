// 매입매출 위쪽 "상반기·하반기 세금계산서 발행" 줄(11/26 사용자 요청 "총 매입액·총 매출액 아래 줄에 상반기·하반기 매입·매출 세금계산서
// 발행건") — 그 해 세금계산서 발행으로 체크한 거래를 반기(1~6월·7~12월)·구분(매입·매출)별로 건수·금액.
// 부가세와 같은 기준: 거래일(세금계산서 날짜)로 나누고 외상 미정산도 넣음(세금계산서는 돈을 받았는지와 상관없음 — 매입매출 목록은 정산 전
// 외상 줄을 숨기지만 이 줄은 셈). 금액은 합계(공급가액 + 부가세 — 바로 위 총 매입액·총 매출액과 같은 기준, lib/credit의 transactionTotal).
// 한 결제로 묶은 줄(payment_group_id)은 매입장처럼 한 건으로 셈. 검사: taxInvoiceSummary.test.ts

import { transactionTotal } from "@/lib/credit";

export type TaxInvoiceRow = {
  id: string;
  type: string;
  trans_date: string;
  tax_invoice_issued: boolean | null;
  payment_group_id?: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
};

export type InvoiceTotals = { count: number; amount: number };
export type HalfInvoiceTotals = { purchase: InvoiceTotals; sales: InvoiceTotals };
export type TaxInvoiceHalfSummary = { h1: HalfInvoiceTotals; h2: HalfInvoiceTotals };

/** 1~6월 = 상반기(h1), 7~12월 = 하반기(h2) — 날짜 글자 "YYYY-MM-DD"의 달로 */
export function halfOf(transDate: string): "h1" | "h2" {
  return Number(transDate.slice(5, 7)) <= 6 ? "h1" : "h2";
}

export function taxInvoiceHalfSummary(rows: TaxInvoiceRow[]): TaxInvoiceHalfSummary {
  const empty = (): HalfInvoiceTotals => ({ purchase: { count: 0, amount: 0 }, sales: { count: 0, amount: 0 } });
  const summary: TaxInvoiceHalfSummary = { h1: empty(), h2: empty() };
  const counted = new Set<string>();
  for (const r of rows) {
    if (!r.tax_invoice_issued) continue;
    const half = halfOf(r.trans_date);
    const side = r.type === "매출" ? "sales" : "purchase";
    const totals = summary[half][side];
    totals.amount += transactionTotal(r);
    // 한 결제 묶음은 한 건(반기·구분마다 한 번)
    const key = `${half}|${side}|${r.payment_group_id || r.id}`;
    if (!counted.has(key)) {
      counted.add(key);
      totals.count += 1;
    }
  }
  return summary;
}
