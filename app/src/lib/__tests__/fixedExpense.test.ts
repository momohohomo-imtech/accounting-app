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
  // 매달 1일에 한 달씩 넘어감(해마다 새로 시작하지 않음)
  assert.deepEqual(
    [fixedExpenseWindow("2026-12-01").from, fixedExpenseWindow("2026-12-01").to],
    ["2025-12-01", "2026-11-30"]
  );
});

const tx = (client_id: string | null, trans_date: string, amount: number, category_id: string | null = null): FixedExpenseTx => ({
  client_id,
  category_id,
  trans_date,
  amount,
});

test("고정지출: 달 평균 = 12개월 합계 ÷ 12, 중간에 새로 시작해서 매달 나온 곳만 시작한 달부터, 낸 달 평균은 참고", () => {
  const today = "2026-11-03";
  const { months } = fixedExpenseWindow(today);
  const txs: FixedExpenseTx[] = [
    // A: 가짜 임대인 매달 110만 원 + 이번 달도 나감
    ...months.map((m) => tx("A", `${m}-01`, 1_100_000)),
    tx("A", "2026-11-01", 1_100_000),
    // B: 가짜 보험사 1년에 한 번 120만 원 → ÷12 = 10만(낸 달 평균 120만은 참고)
    tx("B", "2026-03-10", 1_200_000),
    // C: 가짜 통신사 8월부터 매달 33,000원 → 8월부터 3달로 나눔
    ...["2026-08", "2026-09", "2026-10"].map((m) => tx("C", `${m}-25`, 33_000)),
    // D: 지정 안 했지만 12월부터 매달(11달) → 후보, 12월부터 11달로 나눔
    ...months.slice(1).map((m) => tx("D", `${m}-15`, 50_000)),
    // E: 지정 안 함, 2달 → 후보 아님
    tx("E", "2026-05-02", 900_000),
    tx("E", "2026-06-02", 100_000),
    // 기간 밖·거래처 없음(카테고리도 없음)·오늘 뒤는 뺌
    tx("A", "2025-10-31", 9_999_999),
    tx(null, "2026-05-01", 7_777),
    tx("A", "2026-11-20", 5_555),
  ];
  const clients = [
    { id: "A", name: "가짜 임대인", fixed: true },
    { id: "B", name: "가짜 보험사", fixed: true },
    { id: "C", name: "가짜 통신사", fixed: true },
    { id: "D", name: "가짜 정기 매입처", fixed: false },
    { id: "E", name: "가짜 자재상", fixed: false },
    { id: "F", name: "가짜 새 거래처", fixed: true },
  ];
  const r = fixedExpenseReport(txs, clients, [], today);
  assert.equal(r.recordsFrom, null);
  assert.equal(r.baseMonths, 12);
  assert.deepEqual(
    r.rows.map((x) => [x.name, x.total, x.monthlyAvg, x.divisor, x.since, x.monthsWithSpend, x.activeAvg, x.thisMonth, x.lastDate]),
    [
      ["가짜 임대인", 13_200_000, 1_100_000, 12, null, 12, 1_100_000, 1_100_000, "2026-11-01"],
      ["가짜 보험사", 1_200_000, 100_000, 12, null, 1, 1_200_000, 0, "2026-03-10"],
      ["가짜 통신사", 99_000, 33_000, 3, "2026-08", 3, 33_000, 0, "2026-10-25"],
      ["가짜 새 거래처", 0, 0, 12, null, 0, 0, 0, null],
    ]
  );
  assert.equal(r.totalMonthly, 1_100_000 + 100_000 + 33_000);
  assert.equal(r.yearEstimate, r.totalMonthly * 12);
  assert.equal(r.clientMonthly, r.totalMonthly);
  assert.equal(r.categoryMonthly, 0);
  assert.equal(r.totalYear, 13_200_000 + 1_200_000 + 99_000);
  assert.equal(r.perMonth[months.indexOf("2026-03")], 1_100_000 + 1_200_000);
  assert.equal(r.perMonth[months.indexOf("2026-09")], 1_100_000 + 33_000);
  // 달마다 범위 — 매입 없는 달은 0
  const rowOf = (name: string) => r.rows.find((x) => x.name === name)!;
  assert.deepEqual([rowOf("가짜 임대인").minMonth, rowOf("가짜 임대인").maxMonth], [1_100_000, 1_100_000]);
  assert.deepEqual([rowOf("가짜 보험사").minMonth, rowOf("가짜 보험사").maxMonth], [0, 1_200_000]);
  assert.equal(r.candidateMinMonths, 10);
  assert.deepEqual(
    r.candidates.map((x) => [x.name, x.monthsWithSpend, x.monthlyAvg, x.since]),
    [["가짜 정기 매입처", 11, 50_000, "2025-12"]]
  );
  // 고르기 목록 = 달 평균 큰 순(자재상 2달 100만 ÷ 12 → 83,333, 정기 매입처 12월부터 11달 → 5만)
  assert.deepEqual(
    r.otherClients.map((x) => [x.name, x.monthlyAvg]),
    [
      ["가짜 자재상", 83_333],
      ["가짜 정기 매입처", 50_000],
    ]
  );
});

test("고정지출 새로 시작: 지난달까지 빠짐없이 3달 이상일 때만 — 2달·중간에 빠진 달·끊긴 곳은 ÷12", () => {
  const today = "2026-11-03";
  const txs: FixedExpenseTx[] = [
    // 기록은 12달 다 있음(다른 가짜 거래처)
    tx("ALL", "2025-11-05", 10_000),
    // 2달만(9·10월) → 1년에 한 번 낸 것과 구별이 안 돼서 ÷12
    tx("TWO", "2026-09-01", 60_000),
    tx("TWO", "2026-10-01", 60_000),
    // 7월부터인데 9월이 빠짐 → ÷12
    ...["2026-07", "2026-08", "2026-10"].map((m) => tx("GAP", `${m}-03`, 40_000)),
    // 3월~8월 매달 나오다 끊김(9·10월 없음) → ÷12
    ...["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].map((m) => tx("STOP", `${m}-03`, 120_000)),
    // 6월부터 매달(5달) → 6월부터 5달로
    ...["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map((m) => tx("NEW", `${m}-20`, 50_000)),
  ];
  const ids = ["ALL", "TWO", "GAP", "STOP", "NEW"];
  const r = fixedExpenseReport(
    txs,
    ids.map((id) => ({ id, name: `가짜 ${id}`, fixed: id !== "ALL" })),
    [],
    today
  );
  const by = Object.fromEntries(r.rows.map((x) => [x.id, [x.monthlyAvg, x.divisor, x.since]]));
  assert.deepEqual(by, {
    TWO: [10_000, 12, null],
    GAP: [10_000, 12, null],
    STOP: [60_000, 12, null],
    NEW: [50_000, 5, "2026-06"],
  });
});

test("고정지출 앱 기록이 12달이 안 되면 기록이 있는 달부터 나눔", () => {
  const today = "2026-11-03";
  const { months } = fixedExpenseWindow(today);
  // 앱 기록이 2026-01부터(기간 첫 두 달은 매입이 하나도 없음)
  const recorded = months.slice(2);
  const txs: FixedExpenseTx[] = [
    ...recorded.map((m) => tx("RENT", `${m}-05`, 1_000_000)),
    tx("INS", "2026-04-10", 1_200_000),
    // 9달(2월~10월) 나온 곳 → 기록 10달 기준 후보(10/12 비율 → 9달 이상)
    ...recorded.slice(1).map((m) => tx("NINE", `${m}-07`, 20_000)),
  ];
  const r = fixedExpenseReport(
    txs,
    [
      { id: "RENT", name: "가짜 임대인", fixed: true },
      { id: "INS", name: "가짜 보험사", fixed: true },
      { id: "NINE", name: "가짜 매달 매입처", fixed: false },
    ],
    [],
    today
  );
  assert.equal(r.recordsFrom, "2026-01");
  assert.equal(r.baseMonths, 10);
  assert.deepEqual(
    r.rows.map((x) => [x.name, x.monthlyAvg, x.divisor, x.since]),
    [
      // 기록 첫 달부터 매달 = 새로 시작이 아님, 기록 있는 10달로
      ["가짜 임대인", 1_000_000, 10, null],
      ["가짜 보험사", 120_000, 10, null],
    ]
  );
  assert.equal(r.candidateMinMonths, 9);
  // 2월부터 매달(9달) → 새로 시작(2월부터 9달) + 후보
  assert.deepEqual(
    r.candidates.map((x) => [x.name, x.monthsWithSpend, x.monthlyAvg, x.since]),
    [["가짜 매달 매입처", 9, 20_000, "2026-02"]]
  );
});

test("고정지출 카테고리: 지정 거래처 매입은 거래처 줄, 나머지 지정 카테고리 매입은 카테고리 줄 — 한 번만", () => {
  const today = "2026-11-03";
  const { months } = fixedExpenseWindow(today);
  const txs: FixedExpenseTx[] = [
    // 가짜 주유소(거래처 지정) — 차량 카테고리지만 거래처 줄에만
    ...months.map((m) => tx("GAS", `${m}-03`, 200_000, "CAR")),
    // 다른 차량 비용(정비소, 지정 안 함) — 차량 카테고리 줄
    tx("REPAIR", "2026-02-10", 600_000, "CAR"),
    // 직접 입력한 이름(거래처 없음) 차량 비용도 카테고리 줄
    tx(null, "2026-07-01", 120_000, "CAR"),
    // 급여 카테고리(거래처 없음) 매달 300만
    ...months.map((m) => tx(null, `${m}-25`, 3_000_000, "PAY")),
    // 숙박비(지정) — 두 달만, 들쭉날쭉 → ÷12
    tx("HOTEL", "2026-04-05", 400_000, "STAY"),
    tx("HOTEL", "2026-05-05", 1_200_000, "STAY"),
    // 지정 안 한 카테고리(자재) — 1월부터 매달 10달 → 카테고리 후보
    ...months.slice(2).map((m) => tx("MAT", `${m}-12`, 900_000, "MATERIAL")),
    // 이번 달 급여도 나감
    tx(null, "2026-11-02", 3_000_000, "PAY"),
  ];
  const clients = [
    { id: "GAS", name: "가짜 주유소", fixed: true },
    { id: "REPAIR", name: "가짜 정비소", fixed: false },
    { id: "HOTEL", name: "가짜 숙소", fixed: false },
    { id: "MAT", name: "가짜 자재상", fixed: false },
  ];
  const categories = [
    { id: "CAR", name: "가짜 차량", fixed: true },
    { id: "PAY", name: "가짜 직원급여", fixed: true },
    { id: "STAY", name: "가짜 숙박비", fixed: true },
    { id: "MATERIAL", name: "가짜 원자재", fixed: false },
  ];
  const r = fixedExpenseReport(txs, clients, categories, today);
  assert.deepEqual(
    r.rows.map((x) => [x.kind, x.name, x.total, x.monthlyAvg, x.monthsWithSpend, x.activeAvg]),
    [
      ["category", "가짜 직원급여", 36_000_000, 3_000_000, 12, 3_000_000],
      ["client", "가짜 주유소", 2_400_000, 200_000, 12, 200_000],
      ["category", "가짜 숙박비", 1_600_000, Math.round(1_600_000 / 12), 2, 800_000],
      ["category", "가짜 차량", 720_000, 60_000, 2, 360_000],
    ]
  );
  // 겹침 없이 합계 = 줄 합
  assert.equal(r.totalYear, 36_000_000 + 2_400_000 + 1_600_000 + 720_000);
  assert.equal(r.clientMonthly, 200_000);
  assert.equal(r.categoryMonthly, 3_000_000 + Math.round(1_600_000 / 12) + 60_000);
  assert.equal(r.totalMonthly, r.clientMonthly + r.categoryMonthly);
  assert.equal(r.yearEstimate, r.totalMonthly * 12);
  // 숙박비 범위 0 ~ 120만, 급여 이번 달
  const stay = r.rows.find((x) => x.name === "가짜 숙박비")!;
  assert.deepEqual([stay.minMonth, stay.maxMonth], [0, 1_200_000]);
  assert.equal(r.rows.find((x) => x.name === "가짜 직원급여")!.thisMonth, 3_000_000);
  // 후보: 자재 카테고리·자재상(1월부터 매달 10달), 이미 카테고리 줄에 들어간 정비소·숙소는 고르기 목록에도 없음
  assert.deepEqual(
    r.candidates.map((x) => [x.kind, x.name, x.monthsWithSpend, x.monthlyAvg, x.since]).sort(),
    [
      ["category", "가짜 원자재", 10, 900_000, "2026-01"],
      ["client", "가짜 자재상", 10, 900_000, "2026-01"],
    ]
  );
  assert.deepEqual(
    r.otherClients.map((x) => x.name),
    ["가짜 자재상"]
  );
  assert.deepEqual(
    r.otherCategories.map((x) => x.name),
    ["가짜 원자재"]
  );
});

test("고정지출: 지정한 곳이 없으면 0, 반품(음수)도 합계에 그대로", () => {
  const r = fixedExpenseReport(
    [tx("A", "2026-10-01", 120_000), tx("A", "2026-10-05", -20_000), tx("Z", "2025-11-03", 5_000)],
    [
      { id: "A", name: "가짜 거래처", fixed: false },
      { id: "Z", name: "가짜 다른 거래처", fixed: false },
    ],
    [],
    "2026-11-03"
  );
  assert.equal(r.totalMonthly, 0);
  assert.equal(r.yearEstimate, 0);
  assert.deepEqual(r.rows, []);
  const a = r.otherClients.find((x) => x.name === "가짜 거래처")!;
  assert.equal(a.total, 100_000);
  assert.equal(a.monthlyAvg, Math.round(100_000 / 12));
  assert.equal(a.activeAvg, 100_000);
  assert.equal(a.monthsWithSpend, 1);
});
