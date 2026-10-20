import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupProjectProfit,
  unbilledH2Profit,
  unsettledCreditPurchase,
  projectBasedProfit,
  secondHalfOutlook,
  expectedRevenueOf,
  countedQuote,
  type OutlookProject,
  type OutlookTx,
} from "@/lib/projectProfit";
import type { CreditPayment } from "@/lib/types";

// 어미 A(발주 2,000만) + 귀속 하위 B(발주 없음) + 귀속 하위 C(발주 500만), 별개 프로젝트 D(발주 없음)
const A = { id: "A", quote_amount: 20_000_000 };
const B = { id: "B", quote_amount: null };
const C = { id: "C", quote_amount: 5_000_000 };
const D = { id: "D", quote_amount: null };
const purchase = new Map([
  ["A", 4_000_000],
  ["B", 1_000_000],
  ["C", 500_000],
  ["D", 300_000],
]);
const agency = new Map([["A", 2_000_000]]);

test("귀속 하위의 발주액·매입·대행구매를 어미에 합산 (손익보고서와 같은 기준)", () => {
  const r = groupProjectProfit([A, B, C], purchase, agency);
  assert.equal(r.quote, 25_000_000);
  assert.equal(r.purchase, 5_500_000);
  assert.equal(r.agency, 2_000_000);
  assert.equal(r.profit, 17_500_000);
  assert.equal(r.rate, 70);
});

test("하위 없이 단독이면 자기 금액만, 발주액이 없으면 이익금·이익율 없음", () => {
  assert.equal(groupProjectProfit([A], purchase, agency).profit, 14_000_000);
  const none = groupProjectProfit([D], purchase, agency);
  assert.equal(none.profit, null);
  assert.equal(none.rate, null);
  assert.equal(none.purchase, 300_000);
});


test("하반기 미발행 예상 이익: 상반기에 끊은 기성금은 상반기 결산에 있으니 빼서 두 번 안 잡음", () => {
  // 발주 5,000만 중 5월에 기성금 2,000만 → 하반기 몫은 3,000만 − 하반기 매입 800만 − 대행구매 200만
  assert.equal(unbilledH2Profit(50_000_000, 20_000_000, 8_000_000, 2_000_000), 20_000_000);
  // 상반기 기성금이 없으면 예전과 같음
  assert.equal(unbilledH2Profit(50_000_000, 0, 8_000_000, 2_000_000), 40_000_000);
});

test("외상 미정산 매입: 완납 전 외상만 거래 전체 금액(공급가)으로, 불공제 카테고리는 부가세 포함", () => {
  const tx = (id: string, payment_type: string, total: number, nonDeductible = false) => ({
    id,
    type: "매입",
    payment_type,
    sales_amount: 0,
    sales_vat: 0,
    purchase_amount: total,
    purchase_vat: 0,
    expense_categories: { name: nonDeductible ? "차량" : "자재", vat_non_deductible: nonDeductible },
  });
  const payment = (transaction_id: string, remaining_amount: number) =>
    ({ transaction_id, remaining_amount, paid_date: "2026-09-01", created_at: "2026-09-01T00:00:00Z" }) as CreditPayment;
  const rows = [
    tx("cash", "immediate", 1_100_000), // 즉시 결제 — 제외
    tx("open", "credit", 2_200_000), // 정산 이력 없음 — 공급가 2,000,000
    tx("partial", "credit", 1_100_000), // 일부만 갚음 — 완납 전이라 거래 전체 공급가 1,000,000
    tx("paid", "credit", 3_300_000), // 완납 — 이미 매입 합계에 들어가 있어 제외
    tx("car", "credit", 550_000, true), // 불공제 카테고리 — 총액 550,000
  ];
  const payments = [payment("partial", 600_000), payment("paid", 0)];
  assert.deepEqual(unsettledCreditPurchase(rows, payments), { count: 3, cost: 2_000_000 + 1_000_000 + 550_000 });
  assert.deepEqual(unsettledCreditPurchase([tx("cash", "immediate", 1_100_000)], []), { count: 0, cost: 0 });
});

// ── 대시보드·보고서 이익 예상 공통 계산 (가짜 데이터) ──
const CAT = {
  mat: { name: "원자재", vat_exempt: false, vat_non_deductible: false },
  pay: { name: "직원급여/상여/4대보험", vat_exempt: true, vat_non_deductible: false },
};
let seq = 0;
const sale = (date: string, total: number, project_id: string | null = null, payment_type = "immediate"): OutlookTx & { id: string; payment_type: string } => ({
  id: `s${++seq}`, type: "매출", payment_type, trans_date: date, project_id,
  sales_amount: total, sales_vat: 0, purchase_amount: 0, purchase_vat: 0, expense_categories: null,
});
const buy = (date: string, total: number, project_id: string | null = null, cat = CAT.mat, payment_type = "immediate"): OutlookTx & { id: string; payment_type: string } => ({
  id: `b${++seq}`, type: "매입", payment_type, trans_date: date, project_id,
  sales_amount: 0, sales_vat: 0, purchase_amount: total, purchase_vat: 0, expense_categories: cat,
});
const inYear = (txs: OutlookTx[]) => txs.filter((t) => t.trans_date >= "2026-01-01" && t.trans_date <= "2026-12-31");
const ofProjects = (txs: OutlookTx[], ps: OutlookProject[]) => txs.filter((t) => t.project_id && ps.some((p) => p.id === t.project_id));

// 화면 "산출 내역"의 예시: 진행중 A(발주 9,000만, 하반기 매입 5,000만, 대행구매 500만) + 수금완료 B 매출 8,000만,
// 일반 매입 7,000만, 하반기 인건비 800만 → 하반기 예상 = 1,000만 + 3,500만 − 800만 = 3,700만
const PA: OutlookProject = { id: "PA", name: "진행중 A", status: "ongoing", quote_amount: 90_000_000 };
const PB: OutlookProject = { id: "PB", name: "수금완료 B", status: "collected", quote_amount: 80_000_000 };
const AG = new Map([["PA", 5_000_000]]);
const baseTx = () => [
  buy("2026-08-01", 55_000_000, "PA"),
  sale("2026-09-01", 88_000_000, "PB"),
  buy("2026-09-02", 77_000_000),
  buy("2026-09-25", 8_000_000, null, CAT.pay),
];
const h2Of = (ps: OutlookProject[], txs: OutlookTx[]) => secondHalfOutlook(2026, ps, ofProjects(txs, ps), inYear(txs), AG);

test("하반기 예상: 화면 예시와 같은 3,700만, (나) 프로젝트 매입은 한 번만 차감", () => {
  const h2 = h2Of([PA, PB], baseTx());
  assert.equal(h2.h2Profit, 10_000_000);
  assert.equal(h2.unbilledPendingProfit, 35_000_000);
  assert.equal(h2.h2PayrollCost, 8_000_000);
  assert.equal(h2.h2EstimatedProfit, 37_000_000);
});

test("외상 미정산도 세금계산서 기준으로 반영: 미지급 매입은 비용, 미입금 매출은 매출", () => {
  // 미지급 매입 1,100만(공급가 1,000만) → 하반기 예상 1,000만 감소
  assert.equal(h2Of([PA, PB], [...baseTx(), buy("2026-10-05", 11_000_000, null, CAT.mat, "credit")]).h2EstimatedProfit, 27_000_000);
  // 프로젝트 없는 외상 매출 8,800만(입금 전) — 매출로 들어가야 함(예전엔 빠져 하반기가 −7,000만이었음)
  const credit = baseTx().map((t) => (t.type === "매출" ? { ...t, payment_type: "credit", project_id: null } : t));
  assert.equal(h2Of([PA, PB], credit).h2EstimatedProfit, 37_000_000);
});

test("인건비 카테고리에 프로젝트를 지정해도 하반기 인건비로 차감(미발행 프로젝트 것은 그 프로젝트 매입으로 한 번만)", () => {
  // 수금완료 B에 지정한 인건비 300만 → 인건비로 차감
  const withB = h2Of([PA, PB], [...baseTx(), buy("2026-10-10", 3_000_000, "PB", CAT.pay)]);
  assert.equal(withB.h2PayrollCost, 11_000_000);
  assert.equal(withB.h2EstimatedProfit, 34_000_000);
  // 진행중 A에 지정한 인건비 300만 → A의 하반기 매입으로 차감되고 인건비에는 안 들어감(두 번 안 뺌)
  const withA = h2Of([PA, PB], [...baseTx(), buy("2026-10-10", 3_000_000, "PA", CAT.pay)]);
  assert.equal(withA.h2PayrollCost, 8_000_000);
  assert.equal(withA.h2EstimatedProfit, 34_000_000);
});

test("다음 해 매입은 그 해 하반기 매입으로 빼지 않음", () => {
  assert.equal(h2Of([PA, PB], [...baseTx(), buy("2027-01-15", 5_500_000, "PA")]).h2EstimatedProfit, 37_000_000);
});

test("발주액 0원 프로젝트는 빈칸과 같게 — 실제 매출이 빠지지 않음", () => {
  const zero: OutlookProject = { id: "PD", name: "공사완료 D", status: "done", quote_amount: 0 };
  const blank: OutlookProject = { ...zero, quote_amount: null };
  const txs = [...baseTx(), sale("2026-10-20", 11_000_000, "PD")];
  assert.equal(h2Of([PA, PB, zero], txs).h2EstimatedProfit, 47_000_000);
  assert.equal(h2Of([PA, PB, blank], txs).h2EstimatedProfit, 47_000_000);
});

test("검토중 프로젝트: 발주액은 어디에도 안 넣고, 이미 쓴 매입은 비용으로", () => {
  const review: OutlookProject = { id: "PR", name: "검토중 C", status: "review", quote_amount: 20_000_000 };
  assert.equal(countedQuote(review), 0);
  const txs = [...baseTx(), buy("2026-10-01", 1_100_000, "PR")];
  const ps = [PA, PB, review];
  // 프로젝트 기준: (9,000만 − 5,000만 − 500만) + 8,000만 − 100만(검토중 매입) − 7,000만 − 800만 = 3,600만
  const est = projectBasedProfit(ps, ofProjects(txs, ps), inYear(txs), AG);
  assert.equal(est.profit, 36_000_000);
  assert.equal(est.quoteTotal, 170_000_000);
  // 하반기 예상: 검토중 매입 100만만 반영
  assert.equal(h2Of(ps, txs).h2EstimatedProfit, 36_000_000);
  // 예상 매출액(발주액 − 대행구매)에도 안 들어감
  assert.equal(expectedRevenueOf(ps, AG), 165_000_000);
});

test("프로젝트 기준: 발주액 없는 묶음은 실제 매출로, 귀속 하위 매출은 어미 발주액에 포함된 것으로 봄", () => {
  const solo: OutlookProject = { id: "PS", name: "발주액 없음", status: "collected", quote_amount: null };
  const child: OutlookProject = { id: "PC", name: "귀속 하위", status: "merged", quote_amount: null, parent_project_id: "PA" };
  const txs = [
    ...baseTx(),
    sale("2026-05-01", 5_500_000, "PS"), // 발주액 없는 단독 프로젝트 매출 500만
    buy("2026-05-02", 1_100_000, "PS"), // 그 매입 100만
    sale("2026-06-01", 2_200_000, "PC"), // 귀속 하위에 붙은 매출 200만 — 어미 발주액에 포함
    buy("2026-06-02", 3_300_000, "PC"), // 귀속 하위 매입 300만 — 어미 묶음 비용
  ];
  const ps = [PA, PB, solo, child];
  const est = projectBasedProfit(ps, ofProjects(txs, ps), inYear(txs), AG);
  // A 묶음: 9,000만 − (5,000만 + 300만) − 500만 = 3,200만 / B: 8,000만 / 단독: 500만 − 100만 = 400만 → 1억 1,600만
  assert.equal(est.projectProfit, 116_000_000);
  assert.equal(est.generalExpense, 70_000_000);
  assert.equal(est.payrollCost, 8_000_000);
  assert.equal(est.profit, 38_000_000);
});

test("프로젝트 기준: 외상 미정산 매입도 비용으로(세금계산서 기준)", () => {
  const txs = [...baseTx(), buy("2026-10-05", 11_000_000, "PB", CAT.mat, "credit")];
  const ps = [PA, PB];
  const est = projectBasedProfit(ps, ofProjects(txs, ps), inYear(txs), AG);
  // (9,000만 − 5,000만 − 500만) + (8,000만 − 1,000만) − 7,000만 − 800만 = 2,700만
  assert.equal(est.profit, 27_000_000);
});
