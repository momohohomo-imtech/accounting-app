// 대메뉴 "세무사 열람"(11/26 사용자 요청 "세무사가 볼 수 있는 창 — 회계사가 필요로 할 만한 내용을 정리") 계산 — 세무사 계정이 읽을 수
// 있는 표(거래·거래처·카테고리·결제수단·외상 정산·부가세 예정고지액)로만. 급여·일용직은 세무사 계정이 못 읽는 표라 여기엔 없음.
// 부가세 기준은 앱 전체와 같음(lib/vatBasis.ts — 총액은 부가세 포함으로 보고 공급가액 = 총액 ÷ 1.1, 비과세 카테고리는 총액 = 공급가액,
// 불공제 카테고리는 공제 매입세액에서 뺌, 거래일(세금계산서 날짜) 기준·외상 미정산 포함) — 대시보드 분기별 부가세와 같은 숫자.
// 한 결제로 묶은 줄은 건수만 한 건(매입장처럼). 검사: taxReview.test.ts

import { transactionTotal } from "@/lib/credit";
import { isVatExemptCategory, purchaseCostOf, supplyOf, vatOf } from "@/lib/vatBasis";

export type TaxReviewTx = {
  id: string;
  type: string;
  trans_date: string;
  client_id: string | null;
  client_name_raw: string | null;
  category_id: string | null;
  payment_method_id: string | null;
  payment_type: string | null;
  tax_invoice_issued: boolean | null;
  payment_group_id?: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
};

export type TaxCategory = { id: string; name: string; vat_exempt?: boolean | null; vat_non_deductible?: boolean | null };
export type NamedRef = { id: string; name: string };

export type VatPeriod = { key: string; label: string; months: number[]; total: boolean };

/** 부가세 기간 — 분기 + 1기(1~6월)·2기(7~12월) 합계 + 연간(개인 일반과세자는 1기·2기 확정신고, 4·10월은 예정고지) */
export const VAT_PERIODS: VatPeriod[] = [
  { key: "q1", label: "1분기(1~3월)", months: [1, 2, 3], total: false },
  { key: "q2", label: "2분기(4~6월)", months: [4, 5, 6], total: false },
  { key: "h1", label: "1기 합계(1~6월)", months: [1, 2, 3, 4, 5, 6], total: true },
  { key: "q3", label: "3분기(7~9월)", months: [7, 8, 9], total: false },
  { key: "q4", label: "4분기(10~12월)", months: [10, 11, 12], total: false },
  { key: "h2", label: "2기 합계(7~12월)", months: [7, 8, 9, 10, 11, 12], total: true },
  { key: "year", label: "연간", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], total: true },
];

export const monthOf = (transDate: string) => Number(transDate.slice(5, 7));

function categoryLookup(categories: TaxCategory[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (t: TaxReviewTx) => (t.category_id ? byId.get(t.category_id) ?? null : null);
}

/** 부가세 계산용 줄(카테고리를 붙여 lib/vatBasis 함수에 넘김) */
function basisRow(t: TaxReviewTx, cat: TaxCategory | null) {
  return { ...t, expense_categories: cat };
}

export type Amounts = { count: number; supply: number; vat: number };
const zero = (): Amounts => ({ count: 0, supply: 0, vat: 0 });

/** 같은 묶음(한 결제)·같은 칸이면 한 건으로 세는 도우미 */
function counter() {
  const seen = new Set<string>();
  return (bucket: string, t: TaxReviewTx) => {
    const key = `${bucket}|${t.payment_group_id || t.id}`;
    if (seen.has(key)) return 0;
    seen.add(key);
    return 1;
  };
}

// ── ① 기간별 부가세 요약 ─────────────────────────────────────────────

export type VatPeriodRow = {
  key: string;
  label: string;
  order: number;
  total: boolean;
  salesSupply: number;
  salesVat: number;
  purchaseSupply: number;
  /** 공제 매입세액 — 비과세·불공제 카테고리 아닌 매입의 부가세(대시보드와 같음, 세금계산서 여부와 무관) */
  deductibleVat: number;
  nonDeductibleVat: number;
  /** 비과세 카테고리 매입 합계(부가세 없음) */
  exemptPurchase: number;
  /** 예상 납부(환급)세액 = 매출세액 − 공제 매입세액 */
  net: number;
};

export function vatPeriodRows(rows: TaxReviewTx[], categories: TaxCategory[]): VatPeriodRow[] {
  const catOf = categoryLookup(categories);
  return VAT_PERIODS.map((p, order) => {
    const r: VatPeriodRow = {
      key: p.key,
      label: p.label,
      order,
      total: p.total,
      salesSupply: 0,
      salesVat: 0,
      purchaseSupply: 0,
      deductibleVat: 0,
      nonDeductibleVat: 0,
      exemptPurchase: 0,
      net: 0,
    };
    for (const t of rows) {
      if (!p.months.includes(monthOf(t.trans_date))) continue;
      const cat = catOf(t);
      const row = basisRow(t, cat);
      if (t.type === "매출") {
        r.salesSupply += supplyOf(row);
        r.salesVat += vatOf(row);
        continue;
      }
      r.purchaseSupply += supplyOf(row);
      if (isVatExemptCategory(cat)) r.exemptPurchase += transactionTotal(t);
      else if (cat?.vat_non_deductible) r.nonDeductibleVat += vatOf(row);
      else r.deductibleVat += vatOf(row);
    }
    r.net = r.salesVat - r.deductibleVat;
    return r;
  });
}

// ── ② 기간별 세금계산서 발행·수취 ─────────────────────────────────────

export type InvoicePeriodRow = { key: string; label: string; order: number; total: boolean; sales: Amounts; purchase: Amounts };

export function invoicePeriodRows(rows: TaxReviewTx[], categories: TaxCategory[]): InvoicePeriodRow[] {
  const catOf = categoryLookup(categories);
  return VAT_PERIODS.map((p, order) => {
    const count = counter();
    const r: InvoicePeriodRow = { key: p.key, label: p.label, order, total: p.total, sales: zero(), purchase: zero() };
    for (const t of rows) {
      if (!t.tax_invoice_issued || !p.months.includes(monthOf(t.trans_date))) continue;
      const side = t.type === "매출" ? "sales" : "purchase";
      const row = basisRow(t, catOf(t));
      r[side].supply += supplyOf(row);
      r[side].vat += vatOf(row);
      r[side].count += count(side, t);
    }
    return r;
  });
}

// ── ③ 세금계산서 없는 과세 매입 — 결제수단별(카드·현금영수증 등 다른 증빙 확인용) ─────────────

export type MethodRow = { name: string; h1: Amounts; h2: Amounts; year: Amounts };

export function nonInvoicePurchaseByMethod(rows: TaxReviewTx[], categories: TaxCategory[], methods: NamedRef[]): MethodRow[] {
  const catOf = categoryLookup(categories);
  const methodName = new Map(methods.map((m) => [m.id, m.name]));
  const byName = new Map<string, MethodRow>();
  const count = counter();
  for (const t of rows) {
    if (t.type === "매출" || t.tax_invoice_issued) continue;
    const cat = catOf(t);
    if (isVatExemptCategory(cat)) continue; // 비과세(부가세 없음)는 증빙 확인 대상 아님
    const name = (t.payment_method_id && methodName.get(t.payment_method_id)) || "(결제수단 없음)";
    const r = byName.get(name) ?? { name, h1: zero(), h2: zero(), year: zero() };
    byName.set(name, r);
    const row = basisRow(t, cat);
    const half = monthOf(t.trans_date) <= 6 ? r.h1 : r.h2;
    const supply = supplyOf(row);
    const vat = vatOf(row);
    const c = count(name, t);
    half.supply += supply;
    half.vat += vat;
    half.count += c;
    r.year.supply += supply;
    r.year.vat += vat;
    r.year.count += c;
  }
  return [...byName.values()].sort((a, b) => b.year.supply - a.year.supply);
}

// ── ④ 거래처별 세금계산서 합계(매출처별·매입처별) ─────────────────────

export type ClientInvoiceRow = { name: string; h1: Amounts; h2: Amounts; year: Amounts };

export function clientInvoiceRows(rows: TaxReviewTx[], categories: TaxCategory[], clients: NamedRef[], side: "매출" | "매입"): ClientInvoiceRow[] {
  const catOf = categoryLookup(categories);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const byName = new Map<string, ClientInvoiceRow>();
  const count = counter();
  for (const t of rows) {
    if (!t.tax_invoice_issued || (t.type === "매출") !== (side === "매출")) continue;
    const name = (t.client_id && clientName.get(t.client_id)) || t.client_name_raw?.trim() || "(거래처 없음)";
    const r = byName.get(name) ?? { name, h1: zero(), h2: zero(), year: zero() };
    byName.set(name, r);
    const row = basisRow(t, catOf(t));
    const supply = supplyOf(row);
    const vat = vatOf(row);
    const c = count(name, t);
    const half = monthOf(t.trans_date) <= 6 ? r.h1 : r.h2;
    half.supply += supply;
    half.vat += vat;
    half.count += c;
    r.year.supply += supply;
    r.year.vat += vat;
    r.year.count += c;
  }
  return [...byName.values()].sort((a, b) => b.year.supply - a.year.supply);
}

// ── ⑤ 카테고리별 매입(경비) — 종합소득세 장부 참고 ─────────────────────

export type CategoryExpenseRow = {
  name: string;
  count: number;
  total: number;
  supply: number;
  vat: number;
  /** 이익·소득세 기준 비용(돌려받는 부가세만 뺌 — 불공제는 총액, lib/vatBasis의 purchaseCostOf) */
  cost: number;
  note: string;
};

export function categoryExpenseRows(rows: TaxReviewTx[], categories: TaxCategory[]): CategoryExpenseRow[] {
  const catOf = categoryLookup(categories);
  const byName = new Map<string, CategoryExpenseRow>();
  const count = counter();
  for (const t of rows) {
    if (t.type === "매출") continue;
    const cat = catOf(t);
    const name = cat?.name ?? "(카테고리 없음)";
    const note = isVatExemptCategory(cat) ? "비과세" : cat?.vat_non_deductible ? "불공제" : "";
    const r = byName.get(name) ?? { name, count: 0, total: 0, supply: 0, vat: 0, cost: 0, note };
    byName.set(name, r);
    const row = basisRow(t, cat);
    r.count += count(name, t);
    r.total += transactionTotal(t);
    r.supply += supplyOf(row);
    r.vat += vatOf(row);
    r.cost += purchaseCostOf(row);
  }
  return [...byName.values()].sort((a, b) => b.cost - a.cost);
}

/** 연간 요약 — 매출 공급가액, 경비(소득세 기준 비용), 차액(장부상 이익 참고) */
export function incomeSummary(rows: TaxReviewTx[], categories: TaxCategory[]) {
  const catOf = categoryLookup(categories);
  let sales = 0;
  let cost = 0;
  for (const t of rows) {
    const row = basisRow(t, catOf(t));
    if (t.type === "매출") sales += supplyOf(row);
    else cost += purchaseCostOf(row);
  }
  return { sales, cost, profit: sales - cost };
}

// ── ⑥ 월별 매출·매입 ───────────────────────────────────────────────

export type MonthRow = {
  month: number;
  salesSupply: number;
  salesVat: number;
  purchaseSupply: number;
  purchaseVat: number;
  invoiceSalesCount: number;
  invoicePurchaseCount: number;
};

export function monthlyRows(rows: TaxReviewTx[], categories: TaxCategory[]): MonthRow[] {
  const catOf = categoryLookup(categories);
  const out = Array.from({ length: 12 }, (_, i): MonthRow => ({
    month: i + 1,
    salesSupply: 0,
    salesVat: 0,
    purchaseSupply: 0,
    purchaseVat: 0,
    invoiceSalesCount: 0,
    invoicePurchaseCount: 0,
  }));
  const count = counter();
  for (const t of rows) {
    const m = out[monthOf(t.trans_date) - 1];
    if (!m) continue;
    const row = basisRow(t, catOf(t));
    if (t.type === "매출") {
      m.salesSupply += supplyOf(row);
      m.salesVat += vatOf(row);
      if (t.tax_invoice_issued) m.invoiceSalesCount += count(`s${m.month}`, t);
    } else {
      m.purchaseSupply += supplyOf(row);
      m.purchaseVat += vatOf(row);
      if (t.tax_invoice_issued) m.invoicePurchaseCount += count(`p${m.month}`, t);
    }
  }
  return out;
}

// ── ⑦ 외상 잔액(기준일 현재) ───────────────────────────────────────

export type CreditPaymentLite = { transaction_id: string; paid_date: string; remaining_amount: number; created_at: string };
export type CreditBalanceRow = { name: string; side: "외상매출금" | "외상매입금"; balance: number; open: number; oldest: string };

/**
 * 기준일(asOf)까지의 정산만 반영한 외상 잔액 — 거래처·구분별(잔액 0인 거래는 뺌, 마이너스 잔액도 그대로 — 오래된 외상매출금과 같은 기준).
 * 그 거래의 마지막 정산(기준일까지) 뒤 남은 금액, 정산 이력이 없으면 거래 총액.
 */
export function creditBalanceRows(
  creditTxs: TaxReviewTx[],
  payments: CreditPaymentLite[],
  asOf: string,
  clients: NamedRef[]
): CreditBalanceRow[] {
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const latest = new Map<string, CreditPaymentLite>();
  for (const p of payments) {
    if (p.paid_date > asOf) continue;
    const prev = latest.get(p.transaction_id);
    if (!prev || (p.paid_date.localeCompare(prev.paid_date) || p.created_at.localeCompare(prev.created_at)) >= 0) {
      latest.set(p.transaction_id, p);
    }
  }
  const byKey = new Map<string, CreditBalanceRow>();
  for (const t of creditTxs) {
    if (t.payment_type !== "credit" || t.trans_date > asOf) continue;
    const remaining = latest.get(t.id)?.remaining_amount ?? transactionTotal(t);
    if (remaining === 0) continue;
    const side = t.type === "매출" ? "외상매출금" : "외상매입금";
    const name = (t.client_id && clientName.get(t.client_id)) || t.client_name_raw?.trim() || "(거래처 없음)";
    const key = `${side}|${name}`;
    const r = byKey.get(key) ?? { name, side, balance: 0, open: 0, oldest: t.trans_date };
    byKey.set(key, r);
    r.balance += Number(remaining);
    r.open += 1;
    if (t.trans_date < r.oldest) r.oldest = t.trans_date;
  }
  return [...byKey.values()].sort((a, b) => a.side.localeCompare(b.side, "ko") || b.balance - a.balance);
}

/** 기준일: 지난해면 그해 12월 31일, 올해면 오늘(한국 날짜) */
export function creditAsOf(year: number, today: string): string {
  const yearEnd = `${year}-12-31`;
  return today < yearEnd ? today : yearEnd;
}

/** 부가세 예정고지액(4월·10월) — 1기·2기 줄에 붙임 */
export function noticeFor(notices: { month: number; amount: number }[], periodKey: string): number | null {
  const month = periodKey === "h1" ? 4 : periodKey === "h2" ? 10 : null;
  if (month === null) return null;
  const n = notices.find((x) => Number(x.month) === month);
  return n ? Number(n.amount) : null;
}

