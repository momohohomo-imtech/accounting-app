import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedExpenseReport, fixedExpenseWindow, type FixedExpenseTx } from "@/lib/fixedExpense";

// 가짜 자료만
test("고정지출 기간: 최근 12개월(지난달까지) — 이번 달은 따로, 해를 넘겨도", () => {
  assert.deepEqual(fixedExpenseWindow("2026-11-03"), {
    from: "2025-11-01",
    to: "2026-10-31",
    months: [
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ],
    thisMonth: "2026-11",
  });
  const jan = fixedExpenseWindow("2026-01-15");
  assert.equal(jan.from, "2025-01-01");
  assert.equal(jan.to, "2025-12-31");
  assert.equal(jan.thisMonth, "2026-01");
  assert.equal(fixedExpenseWindow("2028-03-01").to, "2028-02-29");
});

test("고정지출: 지정 거래처 12개월 합계 ÷ 12, 나온 달·낸 달 평균, 이번 달·마지막 날, 후보", () => {
  const today = "2026-11-03";
  const { months } = fixedExpenseWindow(today);
  const txs: FixedExpenseTx[] = [
    // A: 가짜 임대료 매달 110만 원 + 이번 달도 나감
    ...months.map((m) => ({ client_id: "A", trans_date: `${m}-01`, amount: 1_100_000 })),
    { client_id: "A", trans_date: "2026-11-01", amount: 1_100_000 },
    // B: 가짜 보험 1년에 한 번 120만 원
    { client_id: "B", trans_date: "2026-03-10", amount: 1_200_000 },
    // C: 가짜 인터넷 8월부터 3달 33,000원
    ...["2026-08", "2026-09", "2026-10"].map((m) => ({ client_id: "C", trans_date: `${m}-25`, amount: 33_000 })),
    // D: 지정 안 했지만 11달 나옴 → 후보
    ...months.slice(1).map((m) => ({ client_id: "D", trans_date: `${m}-15`, amount: 50_000 })),
    // E: 지정 안 함, 2달 → 후보 아님
    { client_id: "E", trans_date: "2026-05-02", amount: 900_000 },
    { client_id: "E", trans_date: "2026-06-02", amount: 100_000 },
    // 기간 밖·직접 입력 이름·오늘 뒤는 뺌
    { client_id: "A", trans_date: "2025-10-31", amount: 9_999_999 },
    { client_id: null, trans_date: "2026-05-01", amount: 7_777 },
    { client_id: "A", trans_date: "2026-11-20", amount: 5_555 },
  ];
  const clients = [
    { id: "A", name: "가짜 임대인", fixed: true },
    { id: "B", name: "가짜 보험사", fixed: true },
    { id: "C", name: "가짜 통신사", fixed: true },
    { id: "D", name: "가짜 정기 매입처", fixed: false },
    { id: "E", name: "가짜 자재상", fixed: false },
    { id: "F", name: "가짜 새 거래처", fixed: true },
  ];
  const r = fixedExpenseReport(txs, clients, today);
  assert.deepEqual(
    r.rows.map((x) => [x.name, x.total, x.monthlyAvg, x.monthsWithSpend, x.activeAvg, x.thisMonth, x.lastDate]),
    [
      ["가짜 임대인", 13_200_000, 1_100_000, 12, 1_100_000, 1_100_000, "2026-11-01"],
      ["가짜 보험사", 1_200_000, 100_000, 1, 1_200_000, 0, "2026-03-10"],
      ["가짜 통신사", 99_000, 8_250, 3, 33_000, 0, "2026-10-25"],
      ["가짜 새 거래처", 0, 0, 0, 0, 0, null],
    ]
  );
  assert.equal(r.totalMonthly, 1_100_000 + 100_000 + 8_250);
  assert.equal(r.totalYear, 13_200_000 + 1_200_000 + 99_000);
  assert.equal(r.perMonth[months.indexOf("2026-03")], 1_100_000 + 1_200_000);
  assert.equal(r.perMonth[months.indexOf("2026-09")], 1_100_000 + 33_000);
  assert.deepEqual(
    r.candidates.map((x) => [x.name, x.monthsWithSpend, x.monthlyAvg]),
    [["가짜 정기 매입처", 11, Math.round(550_000 / 12)]]
  );
  assert.deepEqual(
    r.others.map((x) => x.name),
    ["가짜 자재상", "가짜 정기 매입처"]
  );
});

test("고정지출: 지정한 곳이 없으면 0, 반품(음수)도 합계에 그대로", () => {
  const r = fixedExpenseReport(
    [
      { client_id: "A", trans_date: "2026-10-01", amount: 120_000 },
      { client_id: "A", trans_date: "2026-10-05", amount: -20_000 },
    ],
    [{ id: "A", name: "가짜 거래처", fixed: false }],
    "2026-11-03"
  );
  assert.equal(r.totalMonthly, 0);
  assert.deepEqual(r.rows, []);
  assert.equal(r.others[0].total, 100_000);
  assert.equal(r.others[0].monthlyAvg, Math.round(100_000 / 12));
  assert.equal(r.others[0].monthsWithSpend, 1);
});
