// 고정지출 — 지정한 거래처·카테고리의 달 평균(사용자 요청 11/3 "지정한 거래처 혹은 매입처를 총매입액 ÷ 12로 달 평균", 이어서 "카테고리에서도
// 지정 — 급여·차량·숙박비·식비 등"). 사용자 결정: 지정은 DB(101 SQL clients.is_fixed_expense, 102 SQL expense_categories.is_fixed_expense),
// 은행 거래는 빼고 매입 거래만(자동이체도 매입매출장에 직접 등록함). 검사: fixedExpense.test.ts.
//  - 기간: 최근 12개월(지난달까지, 한국 시각) — 이번 달은 아직 덜 나가서 평균에서 빼고 "이번 달" 칸에만
//  - 금액: 매입 합계(공급가액 + 부가세 = 실제로 나간 돈), 세금계산서(거래일) 기준 — 외상 미정산도 포함, 프로젝트에 걸린 매입도 포함
//    (숙박비·식대는 늘 프로젝트에 붙어서 빼면 0원)
//  - 한 거래는 한 번만: 지정 거래처에서 산 건 그 거래처 줄, 아니면 지정 카테고리 줄(사용자 결정 "거래처 줄 우선") — 합계가 겹치지 않음.
//    급여는 이 앱 규칙대로 매입매출장 "직원급여/상여/4대보험" 카테고리 매입으로 셈(직원·급여 메뉴 기록은 안 셈 — 두 번 세지 않게)
//  - 달 평균 = 12개월 합계 ÷ 나온 달(12달 중 매입이 있던 달 수, 원 단위 반올림) — "낸 달 평균"(11/3 사용자 결정 "낸 달 평균이 맞다":
//    중간에 시작한 곳·앱에 기록이 없던 달 때문에 ÷12는 실제보다 작게 나옴). 1년에 한 번 내는 것(보험 등)은 그 금액이 그대로 달 평균이
//    되므로 "÷12 평균"(합계 ÷ 12)을 참고로 같이. 달마다 차이가 큰 곳(숙박비·식대·차량)을 위해 "가장 적은 달 ~ 가장 많은 달"도 같이
//  - 후보: 지정 안 한 거래처·카테고리 중 12달 중 10달 이상(이미 다른 줄에 들어간 매입은 빼고 셈)
//  - 직접 입력한 거래처명 매입은 거래처로는 지정할 수 없음(카테고리로는 잡힘) — 거래처로 등록하면 지정 가능

export const FIXED_EXPENSE_MONTHS = 12;
/** 후보로 보여 줄 최소 나온 달 수 */
export const CANDIDATE_MIN_MONTHS = 10;

export type FixedExpenseKind = "client" | "category";
export type FixedExpenseTx = { client_id: string | null; category_id: string | null; trans_date: string; amount: number };
/** 지정할 수 있는 거래처·카테고리 */
export type FixedExpenseTarget = { id: string; name: string; fixed: boolean };

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
  kind: FixedExpenseKind;
  /** 거래처 id 또는 카테고리 id */
  id: string;
  /** 화면용 고유 키("client:id"·"category:id") */
  key: string;
  name: string;
  fixed: boolean;
  /** 12개월 합계 */
  total: number;
  /** 달 평균 = 12개월 합계 ÷ 나온 달("낸 달 평균", 나온 달이 없으면 0) */
  monthlyAvg: number;
  /** 참고: 12개월 합계 ÷ 12(1년에 한 번 내는 것 등) */
  avg12: number;
  /** 12달 중 매입이 있던 달 수 */
  monthsWithSpend: number;
  /** 달마다 합계(window.months 순서) */
  perMonth: number[];
  /** 가장 적은 달·가장 많은 달(매입 없는 달은 0) */
  minMonth: number;
  maxMonth: number;
  /** 마지막 매입일(이번 달 포함) */
  lastDate: string | null;
  /** 이번 달(진행 중) 매입 합계 */
  thisMonth: number;
};

export type FixedExpenseReport = {
  window: FixedExpenseWindow;
  /** 지정한 거래처·카테고리(달 평균 큰 순) */
  rows: FixedExpenseRow[];
  /** 지정 안 했지만 10달 이상 나온 거래처·카테고리(달 평균 큰 순) */
  candidates: FixedExpenseRow[];
  /** 지정 고르기용 — 지정 안 한 거래처·카테고리 중 기간 안에 (다른 줄에 안 들어간) 매입이 있던 곳, 달 평균 큰 순(고르기 글자에 보이는 숫자 순) */
  otherClients: FixedExpenseRow[];
  otherCategories: FixedExpenseRow[];
  /** 매달 기본으로 나가는 돈 = 지정 줄 달 평균의 합(표의 합계 줄과 같게) */
  totalMonthly: number;
  /** 그중 거래처 줄·카테고리 줄 */
  clientMonthly: number;
  categoryMonthly: number;
  /** 1년 환산 = 매달 기본으로 나가는 돈 × 12 */
  yearEstimate: number;
  /** 지정 줄 12개월 실제 합계(표의 "12달 합계" 합계 줄) */
  totalYear: number;
  /** 지정 줄의 달마다 합계 */
  perMonth: number[];
};

const byAvg = (a: FixedExpenseRow, b: FixedExpenseRow) => b.monthlyAvg - a.monthlyAvg || a.name.localeCompare(b.name, "ko");

export function fixedExpenseReport(
  txs: FixedExpenseTx[],
  clients: FixedExpenseTarget[],
  categories: FixedExpenseTarget[],
  today: string
): FixedExpenseReport {
  const window = fixedExpenseWindow(today);
  const monthIndex = new Map(window.months.map((m, i) => [m, i]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const rows = new Map<string, FixedExpenseRow>();
  const rowOf = (kind: FixedExpenseKind, target: FixedExpenseTarget) => {
    const key = `${kind}:${target.id}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        kind,
        id: target.id,
        key,
        name: target.name,
        fixed: target.fixed,
        total: 0,
        monthlyAvg: 0,
        avg12: 0,
        monthsWithSpend: 0,
        perMonth: window.months.map(() => 0),
        minMonth: 0,
        maxMonth: 0,
        lastDate: null,
        thisMonth: 0,
      };
      rows.set(key, row);
    }
    return row;
  };
  const add = (row: FixedExpenseRow, t: FixedExpenseTx, idx: number | undefined, amount: number) => {
    if (idx !== undefined) {
      row.perMonth[idx] += amount;
      row.total += amount;
    } else row.thisMonth += amount;
    if (!row.lastDate || t.trans_date > row.lastDate) row.lastDate = t.trans_date;
  };
  for (const t of txs) {
    if (t.trans_date > today) continue;
    const month = t.trans_date.slice(0, 7);
    const idx = monthIndex.get(month);
    if (idx === undefined && month !== window.thisMonth) continue;
    const amount = Number(t.amount) || 0;
    const client = t.client_id ? clientById.get(t.client_id) : undefined;
    const category = t.category_id ? categoryById.get(t.category_id) : undefined;
    // 한 거래는 한 줄에만: 지정 거래처 → 지정 카테고리. 둘 다 아니면 후보·고르기용으로 거래처·카테고리 양쪽에(합계에는 안 들어감)
    if (client?.fixed) add(rowOf("client", client), t, idx, amount);
    else if (category?.fixed) add(rowOf("category", category), t, idx, amount);
    else {
      if (client) add(rowOf("client", client), t, idx, amount);
      if (category) add(rowOf("category", category), t, idx, amount);
    }
  }
  // 지정했는데 기간 안에 매입이 없는 곳도 표에 0으로
  for (const c of clients) if (c.fixed) rowOf("client", c);
  for (const c of categories) if (c.fixed) rowOf("category", c);
  for (const row of rows.values()) {
    row.monthsWithSpend = row.perMonth.filter((v) => Math.abs(v) > 0.5).length;
    row.monthlyAvg = row.monthsWithSpend ? Math.round(row.total / row.monthsWithSpend) : 0;
    row.avg12 = Math.round(row.total / FIXED_EXPENSE_MONTHS);
    row.minMonth = Math.min(...row.perMonth);
    row.maxMonth = Math.max(...row.perMonth);
  }
  const all = [...rows.values()];
  const fixed = all.filter((r) => r.fixed).sort(byAvg);
  const notFixed = all.filter((r) => !r.fixed);
  const sumAvg = (list: FixedExpenseRow[]) => list.reduce((sum, r) => sum + r.monthlyAvg, 0);
  const totalMonthly = sumAvg(fixed);
  return {
    window,
    rows: fixed,
    candidates: notFixed.filter((r) => r.monthsWithSpend >= CANDIDATE_MIN_MONTHS).sort(byAvg),
    otherClients: notFixed.filter((r) => r.kind === "client" && r.total !== 0).sort(byAvg),
    otherCategories: notFixed.filter((r) => r.kind === "category" && r.total !== 0).sort(byAvg),
    totalMonthly,
    clientMonthly: sumAvg(fixed.filter((r) => r.kind === "client")),
    categoryMonthly: sumAvg(fixed.filter((r) => r.kind === "category")),
    yearEstimate: totalMonthly * FIXED_EXPENSE_MONTHS,
    totalYear: fixed.reduce((sum, r) => sum + r.total, 0),
    perMonth: window.months.map((_, i) => fixed.reduce((sum, r) => sum + r.perMonth[i], 0)),
  };
}
