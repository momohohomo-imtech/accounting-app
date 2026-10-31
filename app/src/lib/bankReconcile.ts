// 통장 잔액 맞추기(097 SQL bank_balance_checks, 검사: bankReconcile.test.ts) — 은행 앱에서 본 실제 잔액을 날짜와 함께 적어 두면,
// 그 날까지 이 앱에 입력한 거래로 계산한 잔액과 비교. 차이가 있으면 빠뜨렸거나 두 번 입력한 통장 거래가 있다는 뜻.
// 앱 계산 잔액 = 계좌의 시작 잔액 + 그 날까지(그 날 포함) 입금 − 출금 — 은행 화면의 계좌 잔액과 같은 계산.
export type BankFlow = { bank_account_id: string; trans_date: string; direction: string; amount: number };
export type BalanceCheck = {
  id: string;
  bank_account_id: string;
  check_date: string;
  actual_balance: number;
  memo: string | null;
};
export type CheckedBalance = BalanceCheck & { app_balance: number; diff: number };

const signed = (f: BankFlow) => (f.direction === "입금" ? Number(f.amount) || 0 : -(Number(f.amount) || 0));

export function balanceAsOf(openingBalance: number, flows: BankFlow[], accountId: string, date: string) {
  let balance = Number(openingBalance) || 0;
  for (const f of flows) if (f.bank_account_id === accountId && f.trans_date <= date) balance += signed(f);
  return balance;
}

/** 계좌별 확인 기록마다 그 날 앱 계산 잔액과 차이(통장 − 앱). 계좌마다 최근 확인이 먼저. */
export function reconcileChecks(
  accounts: { id: string; opening_balance: number | null }[],
  flows: BankFlow[],
  checks: BalanceCheck[]
): Map<string, CheckedBalance[]> {
  const flowsByAccount = new Map<string, BankFlow[]>();
  for (const f of flows) flowsByAccount.set(f.bank_account_id, [...(flowsByAccount.get(f.bank_account_id) ?? []), f]);
  const result = new Map<string, CheckedBalance[]>();
  for (const account of accounts) {
    const accountFlows = [...(flowsByAccount.get(account.id) ?? [])].sort((a, b) => a.trans_date.localeCompare(b.trans_date));
    const accountChecks = checks
      .filter((c) => c.bank_account_id === account.id)
      .sort((a, b) => a.check_date.localeCompare(b.check_date));
    let balance = Number(account.opening_balance) || 0;
    let i = 0;
    const rows: CheckedBalance[] = [];
    for (const check of accountChecks) {
      while (i < accountFlows.length && accountFlows[i].trans_date <= check.check_date) balance += signed(accountFlows[i++]);
      const actual = Number(check.actual_balance) || 0;
      rows.push({ ...check, actual_balance: actual, app_balance: balance, diff: Math.round(actual - balance) || 0 });
    }
    result.set(account.id, rows.reverse());
  }
  return result;
}

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
type Page = { data: BalanceCheck[] | null; error: { code?: string; message: string } | null };

/** 잔액 확인 기록 전부 — 표가 없으면(097 SQL 실행 전) ready: false로 기능을 숨김, 다른 조회 오류는 오류로. */
export async function loadBalanceChecks(query: (from: number, to: number) => PromiseLike<Page>) {
  const checks: BalanceCheck[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) {
      if (from === 0 && MISSING_TABLE.has(error.code ?? "")) return { ready: false, checks };
      throw new Error(`통장 잔액 확인 기록을 불러오지 못했습니다: ${error.message}`);
    }
    checks.push(...(data ?? []));
    if ((data ?? []).length < 1000) return { ready: true, checks };
  }
}
