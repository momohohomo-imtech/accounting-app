import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceAsOf, reconcileChecks, type BankFlow } from "@/lib/bankReconcile";

// 가짜 통장(실제 자료 아님)
const flows: BankFlow[] = [
  { bank_account_id: "a", trans_date: "2026-10-01", direction: "입금", amount: 500_000 },
  { bank_account_id: "a", trans_date: "2026-10-05", direction: "출금", amount: 120_000 },
  { bank_account_id: "a", trans_date: "2026-10-31", direction: "입금", amount: 30_000 },
  { bank_account_id: "b", trans_date: "2026-10-02", direction: "출금", amount: 9_999 },
];

test("통장 잔액: 시작 잔액 + 그 날까지(그 날 포함) 입금 − 출금, 다른 계좌는 빼고", () => {
  assert.equal(balanceAsOf(1_000_000, flows, "a", "2026-09-30"), 1_000_000);
  assert.equal(balanceAsOf(1_000_000, flows, "a", "2026-10-05"), 1_380_000);
  assert.equal(balanceAsOf(1_000_000, flows, "a", "2026-10-31"), 1_410_000);
  assert.equal(balanceAsOf(0, flows, "b", "2026-12-31"), -9_999);
});

test("잔액 맞추기: 확인한 날마다 앱 잔액·차이(통장 − 앱), 최근 확인 먼저", () => {
  const result = reconcileChecks(
    [
      { id: "a", opening_balance: 1_000_000 },
      { id: "b", opening_balance: null },
      { id: "c", opening_balance: 5 },
    ],
    flows,
    [
      { id: "k2", bank_account_id: "a", check_date: "2026-10-31", actual_balance: 1_410_000, memo: null },
      { id: "k1", bank_account_id: "a", check_date: "2026-10-05", actual_balance: 1_392_000, memo: "가짜 메모" },
      { id: "k3", bank_account_id: "b", check_date: "2026-10-01", actual_balance: 0, memo: null },
    ]
  );
  const a = result.get("a")!;
  assert.deepEqual(a.map((r) => [r.id, r.app_balance, r.diff]), [
    ["k2", 1_410_000, 0],
    ["k1", 1_380_000, 12_000], // 통장이 12,000원 더 많음 → 앱에 빠진 입금이 있음
  ]);
  assert.deepEqual(result.get("b")!.map((r) => [r.app_balance, r.diff]), [[0, 0]]); // 출금 전날 확인
  assert.deepEqual(result.get("c"), []);
});

test("잔액 확인 기록 불러오기: 097 실행 전(표 없음)이면 기능 숨김, 다른 오류는 오류로", async () => {
  const { loadBalanceChecks } = await import("@/lib/bankReconcile");
  assert.deepEqual(
    await loadBalanceChecks(() => Promise.resolve({ data: null, error: { code: "PGRST205", message: "no table" } })),
    { ready: false, checks: [] }
  );
  await assert.rejects(
    loadBalanceChecks(() => Promise.resolve({ data: null, error: { code: "XX000", message: "가짜 연결 오류" } })),
    /가짜 연결 오류/
  );
  const page = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `k${i}`, bank_account_id: "a", check_date: "2026-10-01", actual_balance: 1, memo: null }));
  const result = await loadBalanceChecks((from) => Promise.resolve({ data: from === 0 ? page(1000) : page(3), error: null }));
  assert.equal(result.checks.length, 1003);
});
