import { test } from "node:test";
import assert from "node:assert/strict";
import { formatProfitRate, projectOverviewRows, projectOverviewTotals, type OverviewProject } from "@/lib/projectOverview";

// 가짜 자료 — 어미 A(+귀속 하위 A1), B, 검토중 C, 발주액 없는 D
const projects: (OverviewProject & { effective: string })[] = [
  { id: "A", project_code: "2026-1001", name: "가짜 A", status: "ongoing", parent_project_id: null, quote_amount: 100_000_000, effective: "ongoing" },
  { id: "A1", project_code: "2026-1004", name: "가짜 A 추가분", status: "merged", parent_project_id: "A", quote_amount: 20_000_000, effective: "ongoing" },
  { id: "B", project_code: "2026-1002", name: "가짜 B", status: "done", parent_project_id: null, quote_amount: 50_000_000, effective: "done" },
  { id: "C", project_code: "2026-1003", name: "가짜 C", status: "review", parent_project_id: null, quote_amount: 30_000_000, effective: "review" },
  { id: "D", project_code: "2026-1005", name: "가짜 D", status: "ongoing", parent_project_id: null, quote_amount: null, effective: "ongoing" },
];
const purchaseByProject = new Map([
  ["A", 40_000_000],
  ["A1", 5_000_000],
  ["B", 30_000_000],
  ["C", 1_000_000],
  ["D", 2_000_000],
]);
const agencyByProject = new Map([
  ["A", 20_000_000],
  ["A1", 4_000_000],
  ["B", 10_000_000],
]);
const workLogs = [
  { log_date: "2026-10-05", project_id: "A" },
  { log_date: "2026-10-06", project_id: "A" },
  { log_date: "2026-10-06", project_id: "A1" }, // 같은 묶음 같은 날 → 하루
  { log_date: "2026-10-07", project_id: "A1" },
  { log_date: "2026-10-06", project_id: "B" }, // 다른 프로젝트 같은 날 → 그 줄에서 따로 하루
  { log_date: "2026-10-08", project_id: "C" },
];
const tripDays = [
  { project_id: "A", work_date: "2026-10-12" },
  { project_id: "A1", work_date: "2026-10-13" }, // 하위가 이어서 → 같은 출장
  { project_id: "A", work_date: "2026-10-20" },
  { project_id: "B", work_date: "2026-10-06" }, // 작업일지가 있는 날 → 출장
];
const input = {
  projects,
  purchaseByProject,
  agencyByProject,
  isReview: (p: (typeof projects)[number]) => p.effective === "review",
  workLogs,
  tripDays,
};

test("한눈에 보기: 줄 = 어미 + 귀속 하위 묶음, 수주액 = 발주액 − 대행구매, 이익금 = 수주액 − 매입", () => {
  const rows = projectOverviewRows(input);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["A", "B", "C", "D"]
  );
  const a = rows[0];
  assert.equal(a.memberCount, 2);
  assert.equal(a.quote, 120_000_000);
  assert.equal(a.agency, 24_000_000);
  assert.equal(a.contract, 96_000_000);
  assert.equal(a.purchase, 45_000_000);
  assert.equal(a.profit, 51_000_000);
  assert.equal(formatProfitRate(a.profitRate), "42.50%");
  // 10/5·6·7 + 출장 10/12·13·20 → 사내 3·출장 3·총 6, 출장 횟수 2(12~13일 이어짐 + 20일)
  assert.deepEqual(a.workDays, { inhouse: 3, trip: 3, total: 6 });
  assert.equal(a.tripCount, 2);
  assert.equal(a.profitPerDay, 8_500_000);
  for (const r of rows) assert.equal(r.profit, r.contract - r.purchase);
});

test("한눈에 보기: 검토중은 발주액 제외(이미 쓴 매입만), 발주액이 없으면 이익율·근무일당 이익금 '-'", () => {
  const rows = projectOverviewRows(input);
  const c = rows.find((r) => r.id === "C")!;
  assert.equal(c.review, true);
  assert.equal(c.quote, 0);
  assert.equal(c.reviewQuote, 30_000_000);
  assert.equal(c.profit, -1_000_000);
  assert.equal(c.profitRate, null);
  assert.equal(c.profitPerDay, null);
  const d = rows.find((r) => r.id === "D")!;
  assert.equal(d.quote, 0);
  assert.equal(d.profit, -2_000_000);
  assert.equal(formatProfitRate(d.profitRate), "-");
  assert.equal(d.profitPerDay, null);
});

test("한눈에 보기: 합계 = 줄 합(근무일·출장 횟수도), 이익율·근무일당 이익금은 합계로 다시 나눔", () => {
  const rows = projectOverviewRows(input);
  const t = projectOverviewTotals(rows);
  assert.equal(t.count, 4);
  assert.equal(t.reviewCount, 1);
  assert.equal(t.quote, 170_000_000);
  assert.equal(t.contract, 136_000_000);
  assert.equal(t.purchase, 78_000_000);
  assert.equal(t.profit, 58_000_000);
  assert.equal(t.profit, t.contract - t.purchase);
  // B: 10/6(출장) → 사내 0·출장 1, C: 10/8 사내 1 — 같은 날(10/6) A·B 둘 다 했으면 2일로
  assert.deepEqual(t.workDays, { inhouse: 4, trip: 4, total: 8 });
  assert.equal(t.tripCount, 3);
  assert.equal(t.avgTripDays, 4 / 3);
  assert.equal(t.profitPerDay, Math.round(58_000_000 / 8));
  assert.equal(formatProfitRate(t.profitRate), `${((58_000_000 / 170_000_000) * 100).toFixed(2)}%`);
});

test("한눈에 보기: 보고서 '프로젝트별 손익' 머리 요약과 같은 합계(검토중 발주액 제외, 이익금 = Σ발주액 − 매입 − 대행구매)", () => {
  const t = projectOverviewTotals(projectOverviewRows(input));
  // reports/page.tsx의 projectSummary와 같은 식 — 프로젝트마다 profit = 발주액 − 매입 − 대행구매, 검토중은 발주액을 뺌
  const profitOf = (p: (typeof projects)[number]) =>
    (p.quote_amount ?? 0) - (purchaseByProject.get(p.id) ?? 0) - (agencyByProject.get(p.id) ?? 0);
  const summaryProfit = projects.reduce(
    (s, p) => s + (p.effective === "review" ? profitOf(p) - (p.quote_amount ?? 0) : profitOf(p)),
    0
  );
  const summaryQuote = projects.filter((p) => p.effective !== "review").reduce((s, p) => s + (p.quote_amount ?? 0), 0);
  assert.equal(t.profit, summaryProfit);
  assert.equal(t.quote, summaryQuote);
});

test("한눈에 보기: 출장일지 표가 없으면(null) 출장 0, 프로젝트가 없으면 합계 0·'-'", () => {
  const rows = projectOverviewRows({ ...input, tripDays: null });
  assert.equal(rows[0].tripCount, 0);
  assert.equal(rows[0].workDays.trip, 0);
  const empty = projectOverviewTotals([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.profitRate, null);
  assert.equal(empty.avgTripDays, null);
  assert.equal(empty.profitPerDay, null);
});
