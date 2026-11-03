// 고정지출 — 지정한 거래처의 달 평균(사용자 요청 11/3 "지정한 거래처 혹은 매입처를 총매입액 ÷ 12로 달 평균", 사용자 결정: 지정은
// DB(101 SQL clients.is_fixed_expense), 은행 거래는 빼고 매입 거래만 — 자동이체도 매입매출장에 직접 등록함). 검사: fixedExpense.test.ts.
//  - 기간: 최근 12개월(지난달까지, 한국 시각) — 이번 달은 아직 덜 나가서 평균에서 빼고 "이번 달" 칸에만
//  - 금액: 매입 합계(공급가액 + 부가세 = 실제로 나간 돈), 세금계산서(거래일) 기준 — 외상 미정산도 포함
//  - 달 평균 = 12개월 합계 ÷ 12(원 단위 반올림) — 1년에 한 번 내는 것(보험 등)도 저절로 월 금액이 됨. 중간에 시작·끊긴 곳은
//    "나온 달"(12달 중 매입이 있던 달 수)과 "낸 달 평균"(합계 ÷ 나온 달)을 같이 보여 줌(12로 나누면 실제 월 금액보다 작게 나와서)
//  - 후보: 지정 안 한 거래처 중 12달 중 10달 이상 매입이 있던 곳(빠뜨린 고정지출 찾기)
//  - 거래처 목록에 없는(직접 입력한 이름) 매입은 지정할 수 없어서 뺌 — 거래처로 등록하면 지정 가능

export const FIXED_EXPENSE_MONTHS = 12;
/** 후보로 보여 줄 최소 나온 달 수 */
export const CANDIDATE_MIN_MONTHS = 10;

export type FixedExpenseTx = { client_id: string | null; trans_date: string; amount: number };
export type FixedExpenseClient = { id: string; name: string; fixed: boolean };

export type FixedExpenseWindow = {
  /** 기간 첫날·마지막 날(YYYY-MM-DD) — 12달 전 1일 ~ 지난달 말일 */
  from: string;
  to: string;
  /** 기간 안의 달(YYYY-MM) 12개, 오래된 달부터 */
  months: string[];
  /** 이번 달(YYYY-MM) — 평균에서 빼고 따로 */
  thisMonth: string;
};

const ym = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 7);
const lastDayOf = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** today = 한국 시각 오늘(YYYY-MM-DD) */
export function fixedExpenseWindow(today: string): FixedExpenseWindow {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const months = Array.from({ length: FIXED_EXPENSE_MONTHS }, (_, i) => ym(y, m - FIXED_EXPENSE_MONTHS + i));
  return { from: `${months[0]}-01`, to: lastDayOf(months[months.length - 1]), months, thisMonth: today.slice(0, 7) };
}

export type FixedExpenseRow = {
  clientId: string;
  name: string;
  fixed: boolean;
  /** 12개월 합계 */
  total: number;
  /** 달 평균 = 12개월 합계 ÷ 12 */
  monthlyAvg: number;
  /** 12달 중 매입이 있던 달 수 */
  monthsWithSpend: number;
  /** 낸 달 평균 = 12개월 합계 ÷ 나온 달(나온 달이 없으면 0) */
  activeAvg: number;
  /** 달마다 합계(window.months 순서) */
  perMonth: number[];
  /** 마지막 매입일(이번 달 포함) */
  lastDate: string | null;
  /** 이번 달(진행 중) 매입 합계 */
  thisMonth: number;
};

export type FixedExpenseReport = {
  window: FixedExpenseWindow;
  /** 지정한 거래처(달 평균 큰 순) */
  rows: FixedExpenseRow[];
  /** 지정 안 했지만 10달 이상 나온 거래처(달 평균 큰 순) */
  candidates: FixedExpenseRow[];
  /** 지정 안 한 거래처 중 기간 안에 매입이 있던 곳(지정 고르기용, 12개월 합계 큰 순) */
  others: FixedExpenseRow[];
  /** 매달 기본으로 나가는 돈 = 지정 거래처 달 평균의 합(표의 합계 줄과 같게) */
  totalMonthly: number;
  /** 지정 거래처 12개월 합계 */
  totalYear: number;
  /** 지정 거래처의 달마다 합계 */
  perMonth: number[];
};

const byAvg = (a: FixedExpenseRow, b: FixedExpenseRow) => b.monthlyAvg - a.monthlyAvg || a.name.localeCompare(b.name, "ko");

export function fixedExpenseReport(txs: FixedExpenseTx[], clients: FixedExpenseClient[], today: string): FixedExpenseReport {
  const window = fixedExpenseWindow(today);
  const monthIndex = new Map(window.months.map((m, i) => [m, i]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const rows = new Map<string, FixedExpenseRow>();
  const rowOf = (c: FixedExpenseClient) => {
    let row = rows.get(c.id);
    if (!row) {
      row = {
        clientId: c.id,
        name: c.name,
        fixed: c.fixed,
        total: 0,
        monthlyAvg: 0,
        monthsWithSpend: 0,
        activeAvg: 0,
        perMonth: window.months.map(() => 0),
        lastDate: null,
        thisMonth: 0,
      };
      rows.set(c.id, row);
    }
    return row;
  };
  for (const t of txs) {
    const client = t.client_id ? clientById.get(t.client_id) : undefined;
    if (!client || t.trans_date > today) continue;
    const month = t.trans_date.slice(0, 7);
    const idx = monthIndex.get(month);
    if (idx === undefined && month !== window.thisMonth) continue;
    const amount = Number(t.amount) || 0;
    const row = rowOf(client);
    if (idx !== undefined) {
      row.perMonth[idx] += amount;
      row.total += amount;
    } else row.thisMonth += amount;
    if (!row.lastDate || t.trans_date > row.lastDate) row.lastDate = t.trans_date;
  }
  // 지정했는데 기간 안에 매입이 없는 거래처도 표에 0으로
  for (const c of clients) if (c.fixed) rowOf(c);
  for (const row of rows.values()) {
    row.monthsWithSpend = row.perMonth.filter((v) => Math.abs(v) > 0.5).length;
    row.monthlyAvg = Math.round(row.total / FIXED_EXPENSE_MONTHS);
    row.activeAvg = row.monthsWithSpend ? Math.round(row.total / row.monthsWithSpend) : 0;
  }
  const all = [...rows.values()];
  const fixed = all.filter((r) => r.fixed).sort(byAvg);
  const notFixed = all.filter((r) => !r.fixed);
  return {
    window,
    rows: fixed,
    candidates: notFixed.filter((r) => r.monthsWithSpend >= CANDIDATE_MIN_MONTHS).sort(byAvg),
    others: notFixed.filter((r) => r.total !== 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ko")),
    totalMonthly: fixed.reduce((sum, r) => sum + r.monthlyAvg, 0),
    totalYear: fixed.reduce((sum, r) => sum + r.total, 0),
    perMonth: window.months.map((_, i) => fixed.reduce((sum, r) => sum + r.perMonth[i], 0)),
  };
}
