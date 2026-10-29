import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupProjectProfit,
  unbilledH2Profit,
  unsettledCreditPurchase,
  projectBasedProfit,
  secondHalfOutlook,
  groupRevenue,
  countedQuote,
  unbilledInvoiceVat,
  unbilledRemainingByGroup,
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

test("하반기 미발행 예상 이익: 발주액보다 계산서를 더 끊으면 실제 금액, 하반기 전에 이미 더 끊었으면 하반기 매입만", () => {
  // 발주 2,000만(남은 2,000만)인데 하반기에 2,500만 발행 → 매출 2,500만 − 하반기 매입 200만
  assert.equal(unbilledH2Profit(20_000_000, 0, 2_000_000, 0, 25_000_000), 23_000_000);
  // 남은 발주액보다 적게 끊었으면 그대로 남은 발주액 기준
  assert.equal(unbilledH2Profit(20_000_000, 0, 2_000_000, 0, 5_000_000), 18_000_000);
  // 발주 1,000만인데 상반기에 1,200만 발행 → 하반기 매출 없음, 하반기 매입 100만만(예전엔 −300만)
  assert.equal(unbilledH2Profit(10_000_000, 12_000_000, 1_000_000, 0), -1_000_000);
});

test("묶음 매출: 발주액 − 대행구매, 실제로 더 끊었으면 실제 금액, 발주액 없으면 실제 매출(대행구매를 또 빼지 않음)", () => {
  assert.equal(groupRevenue(20_000_000, 2_000_000, 5_000_000), 18_000_000);
  assert.equal(groupRevenue(20_000_000, 2_000_000, 25_000_000), 25_000_000);
  assert.equal(groupRevenue(0, 3_000_000, 5_000_000), 5_000_000);
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
  assert.equal(est.revenue, 165_000_000);
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

test("프로젝트 기준: 프로젝트 없이 등록한 매출도 더하고(매입은 원래 일반경비), 발주액보다 더 끊은 계산서는 실제 금액", () => {
  const ps = [PA, PB];
  // 프로젝트 없는 매출 330만(공급가 300만) → 이익·예상 매출액 300만 증가(예전엔 매입만 빠지고 매출은 빠졌음)
  const withGeneral = [...baseTx(), sale("2026-10-22", 3_300_000)];
  const est = projectBasedProfit(ps, ofProjects(withGeneral, ps), inYear(withGeneral), AG);
  assert.equal(est.generalSales, 3_000_000);
  // 기본: A 3,500만 + B 8,000만 − 일반 매입 7,000만 − 인건비 800만 = 3,700만
  assert.equal(est.profit, 37_000_000 + 3_000_000);
  assert.equal(est.revenue, 165_000_000 + 3_000_000);
  // 수금완료 B(발주 8,000만)에 계산서를 9,900만(공급가 9,000만)까지 끊음 → B 매출 9,000만으로
  const over = [...baseTx(), sale("2026-10-25", 11_000_000, "PB")];
  const estOver = projectBasedProfit(ps, ofProjects(over, ps), inYear(over), AG);
  assert.equal(estOver.profit, 37_000_000 + 10_000_000);
  assert.equal(estOver.revenue, 175_000_000);
});

test("하반기 예상: 발주액보다 더 끊은 계산서는 실제 금액으로(미발행 묶음 매출은 하반기 장부에서 빠지므로)", () => {
  const awaiting: OutlookProject = { id: "PW", name: "수금대기 W", status: "done_awaiting_payment", quote_amount: 20_000_000 };
  const txs = [...baseTx(), buy("2026-10-10", 2_200_000, "PW"), sale("2026-10-28", 27_500_000, "PW", "credit")];
  const h2 = h2Of([PA, PB, awaiting], txs);
  // A 3,500만 + W(2,500만 − 200만) 2,300만 = 5,800만
  assert.equal(h2.unbilledPendingProfit, 58_000_000);
  assert.equal(h2.h2EstimatedProfit, 10_000_000 + 58_000_000 - 8_000_000);
});

test("프로젝트 기준: 외상 미정산 매입도 비용으로(세금계산서 기준)", () => {
  const txs = [...baseTx(), buy("2026-10-05", 11_000_000, "PB", CAT.mat, "credit")];
  const ps = [PA, PB];
  const est = projectBasedProfit(ps, ofProjects(txs, ps), inYear(txs), AG);
  // (9,000만 − 5,000만 − 500만) + (8,000만 − 1,000만) − 7,000만 − 800만 = 2,700만
  assert.equal(est.profit, 27_000_000);
});

test("1월 부가세 미발행 예상분: 남은 발주액(대행구매·이미 끊은 매출 차감)의 10%", () => {
  const awaiting: OutlookProject = { id: "PD", name: "수금대기 D", status: "done_awaiting_payment", quote_amount: 30_000_000 };
  const billed: OutlookProject = { id: "PE", name: "다 끊은 E", status: "done", quote_amount: 10_000_000 };
  const over: OutlookProject = { id: "PF", name: "더 끊은 F", status: "done", quote_amount: 10_000_000 };
  const review: OutlookProject = { id: "PR", name: "검토중 G", status: "review", quote_amount: 20_000_000 };
  const zero: OutlookProject = { id: "PZ", name: "발주액 0원 H", status: "ongoing", quote_amount: 0 };
  const ps = [PA, PB, awaiting, billed, over, review, zero];
  const txs = [
    ...baseTx(),
    sale("2026-10-01", 22_000_000, "PD", "credit"), // 입금 전 외상도 끊은 계산서 — 공급가 2,000만 차감
    sale("2026-05-01", 11_000_000, "PE"), // 상반기에 다 끊음
    sale("2026-09-01", 11_550_000, "PF"), // 발주액보다 더 끊음(추가 공사 등) — 0 아래로 안 내려감
  ];
  // A: 9,000만 − 대행구매 500만 = 8,500만 → 850만 / D: 3,000만 − 2,000만 = 1,000만 → 100만
  // E·F: 남은 것 없음 / 수금완료 B·검토중·발주액 0원: 대상 아님
  assert.deepEqual(unbilledInvoiceVat(ps, ofProjects(txs, ps), AG), { count: 2, supply: 95_000_000, vat: 9_500_000 });
  assert.deepEqual(unbilledInvoiceVat([PB], ofProjects(txs, [PB]), AG), { count: 0, supply: 0, vat: 0 });
});

// ── 어미 + 귀속 하위 묶음 (가짜 데이터) ──
const childOf = (id: string, parent: string, quote: number | null, status = "merged"): OutlookProject => ({
  id,
  name: `귀속 하위 ${id}`,
  status,
  quote_amount: quote,
  parent_project_id: parent,
});

test("하반기 예상: 귀속 하위에 끊은 매출은 어미 발주액에 포함된 것으로 — 두 번 안 잡음", () => {
  const child = childOf("PC", "PA", null);
  const txs = [
    ...baseTx(),
    sale("2026-05-01", 11_000_000, "PC"), // 상반기에 하위로 끊은 기성금 1,000만 — 상반기 확정 이익에 이미 있음
    sale("2026-09-10", 11_000_000, "PC"), // 하반기에 하위로 끊은 1,000만 — 어미 발주액의 일부
  ];
  const h2 = h2Of([PA, PB, child], txs);
  // 하반기 매출-매입은 하위 매출을 빼고 1,000만, 미발행 = 9,000만 − 1,000만(상반기분) − 5,000만 − 500만 = 2,500만
  assert.equal(h2.h2Profit, 10_000_000);
  assert.equal(h2.unbilledPendingProfit, 25_000_000);
  assert.equal(h2.h1BilledSales, 10_000_000);
  assert.equal(h2.h2EstimatedProfit, 27_000_000);
  assert.deepEqual(h2.unbilledProjectNames, ["진행중 A 외 1건"]);
});

test("하반기 예상: 타 프로젝트 귀속 하위의 발주액도 어미 묶음 발주액으로(예전엔 빠졌음), 하위 매입은 한 번만", () => {
  const child = childOf("PC", "PA", 10_000_000);
  const txs = [...baseTx(), buy("2026-10-01", 2_200_000, "PC")];
  const h2 = h2Of([PA, PB, child], txs);
  // 미발행 = (9,000만 + 1,000만) − (5,000만 + 200만) − 500만 = 4,300만, 하위 매입 200만은 미발행 쪽에서만 차감
  assert.equal(h2.unbilledPendingProfit, 43_000_000);
  assert.equal(h2.h2Profit, 10_000_000);
  assert.equal(h2.h2EstimatedProfit, 45_000_000);
});

test("하반기 예상: 작년에 끊은 계산서도 발주액에서 뺌(그 해 이익에 이미 들어감)", () => {
  const txs = [...baseTx(), sale("2025-12-15", 22_000_000, "PA")];
  const h2 = h2Of([PA, PB], txs);
  // 미발행 = 9,000만 − 2,000만(작년분) − 5,000만 − 500만 = 1,500만
  assert.equal(h2.unbilledPendingProfit, 15_000_000);
  assert.equal(h2.priorBilledSales, 20_000_000);
  assert.equal(h2.h1BilledSales, 0);
  assert.equal(h2.h2EstimatedProfit, 17_000_000);
});

test("1월 부가세 미발행 예상분: 하위 발주액은 더하고 하위로 끊은 매출은 빼서 묶음 하나로", () => {
  const child = childOf("PC", "PA", 10_000_000);
  const ps = [PA, PB, child];
  const txs = [...baseTx(), sale("2026-09-10", 11_000_000, "PC")];
  // (9,000만 + 1,000만) − 대행구매 500만 − 하위 매출 1,000만 = 8,500만 → 850만, 묶음 1건
  assert.deepEqual(unbilledInvoiceVat(ps, ofProjects(txs, ps), AG), { count: 1, supply: 85_000_000, vat: 8_500_000 });
});

test("묶음 상태: 귀속 하위는 어미 상태를 따르고, 자기 상태가 있는 하위는 자기 상태로", () => {
  // 어미가 수금 완료면 귀속 하위도 끝난 것 — 미발행 대상 아님
  const doneRoot: OutlookProject = { id: "PX", name: "수금완료 X", status: "collected", quote_amount: 30_000_000 };
  const merged = childOf("PXC", "PX", 5_000_000);
  // 자기 상태가 진행중인 하위는 그 하위만 미발행 대상(어미 없이 하위 이름으로)
  const ongoingChild = childOf("PXO", "PX", 4_000_000, "ongoing");
  const ps = [doneRoot, merged, ongoingChild];
  assert.deepEqual(unbilledInvoiceVat(ps, [], new Map()), { count: 1, supply: 4_000_000, vat: 400_000 });
  assert.deepEqual(secondHalfOutlook(2026, ps, [], [], new Map()).unbilledProjectNames, ["귀속 하위 PXO"]);
});

test("검토중 어미의 귀속 하위 발주액도 합계에서 뺌(이미 쓴 매입은 비용)", () => {
  const reviewRoot: OutlookProject = { id: "PR", name: "검토중 R", status: "review", quote_amount: 20_000_000 };
  const child = childOf("PRC", "PR", 5_000_000);
  const ps = [reviewRoot, child];
  const txs = [buy("2026-10-01", 1_100_000, "PRC")];
  const est = projectBasedProfit(ps, ofProjects(txs, ps), inYear(txs), new Map());
  assert.equal(est.quoteTotal, 0);
  assert.equal(est.profit, -1_000_000);
  assert.equal(est.revenue, 0);
  // 진행중 어미면 하위 발주액까지 예상 매출액
  assert.equal(projectBasedProfit([{ ...reviewRoot, status: "ongoing" }, child], [], [], new Map()).revenue, 25_000_000);
});

test("연말 점검: 미발행 묶음마다 남은 발행 예정액·발행한 매출·마지막 발행일(어미 + 귀속 하위)", () => {
  const child = childOf("PC", "PA", 10_000_000);
  const done: OutlookProject = { id: "PD", name: "다 끊은 D", status: "done", quote_amount: 10_000_000 };
  const ps = [PA, PB, child, done];
  const txs = [
    ...baseTx(),
    sale("2026-05-10", 6_600_000, "PC"), // 하위로 끊은 600만
    sale("2026-09-20", 3_300_000, "PA"), // 어미로 끊은 300만 — 마지막 발행일
    sale("2026-08-01", 11_000_000, "PD"), // 다 끊음 → 남은 것 0
  ];
  const rows = unbilledRemainingByGroup(ps, ofProjects(txs, ps), AG).map((g) => ({
    label: g.label,
    members: g.members.map((p) => p.id),
    quote: g.quote,
    agency: g.agency,
    billed: g.billed,
    remaining: g.remaining,
    lastBilled: g.lastBilled,
  }));
  assert.deepEqual(rows, [
    // (9,000만 + 1,000만) − 대행구매 500만 − (300만 + 600만) = 8,600만
    { label: "진행중 A 외\u00a01건", members: ["PA", "PC"], quote: 100_000_000, agency: 5_000_000, billed: 9_000_000, remaining: 86_000_000, lastBilled: "2026-09-20" },
    { label: "다 끊은 D", members: ["PD"], quote: 10_000_000, agency: 0, billed: 10_000_000, remaining: 0, lastBilled: "2026-08-01" },
  ]);
});

test("예전 3단 귀속(어미 ← 하위 ← 하위의 하위)은 맨 위 어미 묶음으로 — 상태도 맨 위 어미를 따름", () => {
  const middle = childOf("PM", "PA", 10_000_000);
  const grandchild = childOf("PG", "PM", 5_000_000);
  const ps = [PA, middle, grandchild];
  const txs = [sale("2026-09-10", 11_000_000, "PG")];
  const rows = unbilledRemainingByGroup(ps, ofProjects(txs, ps), AG);
  // (9,000만 + 1,000만 + 500만) − 대행구매 500만 − 하위의 하위 매출 1,000만 = 9,000만, 한 묶음
  assert.deepEqual(
    rows.map((g) => [g.rootId, g.members.map((p) => p.id), g.remaining]),
    [["PA", ["PA", "PM", "PG"], 90_000_000]]
  );
  // 검토중 맨 위 어미면 하위의 하위 발주액도 합계에서 빠짐
  const reviewTop = { ...PA, status: "review" };
  assert.equal(projectBasedProfit([reviewTop, middle, grandchild], [], [], new Map()).quoteTotal, 0);
  // 서로를 가리키는 잘못된 자료는 묶지 않고 각자
  const loopA = childOf("LA", "LB", 1_000_000, "ongoing");
  const loopB = childOf("LB", "LA", 2_000_000, "ongoing");
  assert.equal(unbilledRemainingByGroup([loopA, loopB], [], new Map()).length, 2);
});
