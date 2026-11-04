// 고정지출 — 지정한 거래처·카테고리의 달 평균(사용자 요청 11/3 "지정한 거래처 혹은 매입처를 총매입액 ÷ 12로 달 평균", 이어서 "카테고리에서도
// 지정 — 급여·차량·숙박비·식비 등"). 사용자 결정: 지정은 DB(101 SQL clients.is_fixed_expense, 102 SQL expense_categories.is_fixed_expense),
// 은행 거래는 빼고 매입 거래만(자동이체도 매입매출장에 직접 등록함). 검사: fixedExpense.test.ts.
//  - 기간: 최근 12개월(지난달까지, 한국 시각) — 해마다 새로 시작하지 않고 매달 1일에 한 달씩 넘어감(보고서에서 고른 연도와 상관없음,
//    사용자 확인 11/3 "현시점에 이전 12개월"). 이번 달은 아직 덜 나가서 평균에서 빼고 "이번 달" 칸에만
//  - 금액: 매입 합계(공급가액 + 부가세 = 실제로 나간 돈), 세금계산서(거래일) 기준 — 외상 미정산도 포함, 프로젝트에 걸린 매입도 포함
//    (숙박비·식대는 늘 프로젝트에 붙어서 빼면 0원)
//  - 한 거래는 한 번만: 지정 거래처에서 산 건 그 거래처 줄, 아니면 지정 카테고리 줄(사용자 결정 "거래처 줄 우선") — 합계가 겹치지 않음.
//    급여는 이 앱 규칙대로 매입매출장 "직원급여/상여/4대보험" 카테고리 매입으로 셈(직원·급여 메뉴 기록은 안 셈 — 두 번 세지 않게)
//  - 달 평균 = 12개월 합계 ÷ 12(원 단위 반올림) — "평균적인 한 달"이라 1년에 한 번 내는 것(보험)·가끔 나가는 것(숙박비)도 매달 몫으로
//    나눔. 사용자가 "낸 달 평균"(합계 ÷ 나온 달)으로 바꿨다가 이 이유로 ÷12로 되돌림(11/3 "추천대로"). ÷12가 작게 나오는 두 경우만 자동으로:
//    · 중간에 새로 시작해서 그 뒤로 지난달까지 매달 나온 곳(3달 이상) → 시작한 달부터 나눔(since, 화면에 "○월부터")
//    · 앱 기록이 12달이 안 되면(기간 첫 달부터 매입이 하나도 없으면) 기록이 있는 달부터 나눔(recordsFrom·baseMonths)
//    "낸 달 평균"(합계 ÷ 나온 달)은 참고 칸, 달마다 차이가 큰 곳(숙박비·식대·차량)을 위해 "가장 적은 달 ~ 가장 많은 달"도 같이
//  - 후보: 지정 안 한 거래처·카테고리 중 거의 매달(나누는 달의 10/12 이상) 나왔거나 중간에 새로 시작해서 매달 나온 곳(이미 다른 줄에
//    들어간 매입은 빼고 셈)
//  - 직접 입력한 거래처명 매입은 거래처로는 지정할 수 없음(카테고리로는 잡힘) — 거래처로 등록하면 지정 가능

export const FIXED_EXPENSE_MONTHS = 12;
/** 후보로 보여 줄 최소 나온 달 수(12달 기준 — 앱 기록이 짧으면 그 비율만큼) */
export const CANDIDATE_MIN_MONTHS = 10;
/** "중간에 새로 시작해서 그 뒤로 매달 나온 곳"으로 볼 최소 달 수(지난달까지 빠짐없이) — 1~2달이면 1년에 한 번 낸 것과 구별이 안 됨 */
export const NEW_REGULAR_MIN_MONTHS = 3;

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
  /** 달 평균 = 12개월 합계 ÷ 나눈 달(divisor) */
  monthlyAvg: number;
  /** 나눈 달 — 보통 12(앱 기록이 짧으면 기록 있는 달 수), 중간에 새로 시작해서 매달 나온 곳은 시작한 달부터 지난달까지 */
  divisor: number;
  /** 중간에 새로 시작해서 그 뒤로 매달 나온 곳이면 시작한 달(YYYY-MM), 아니면 null */
  since: string | null;
  /** 12달 중 매입이 있던 달 수 */
  monthsWithSpend: number;
  /** 참고: 낸 달 평균 = 12개월 합계 ÷ 나온 달(나온 달이 없으면 0) */
  activeAvg: number;
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
  /** 앱 기록(매입)이 기간 첫 달보다 늦게 시작하면 그 달(YYYY-MM) — 그 앞 달은 나누는 달에서 뺌. 12달 다 있으면 null */
  recordsFrom: string | null;
  /** 기본으로 나누는 달 수(12, 앱 기록이 짧으면 기록 있는 달 수) */
  baseMonths: number;
  /** 후보 기준 나온 달 수 */
  candidateMinMonths: number;
  /** 지정한 거래처·카테고리(달 평균 큰 순) */
  rows: FixedExpenseRow[];
  /** 지정 안 했지만 거의 매달 나왔거나 중간에 새로 시작해서 매달 나온 거래처·카테고리(달 평균 큰 순) */
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
        divisor: FIXED_EXPENSE_MONTHS,
        since: null,
        monthsWithSpend: 0,
        activeAvg: 0,
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
  // 앱 기록이 시작된 달 = 기간 안에서 매입(거래처·카테고리 상관없이)이 처음 있는 달
  let recordsStart = FIXED_EXPENSE_MONTHS;
  for (const t of txs) {
    if (t.trans_date > today) continue;
    const month = t.trans_date.slice(0, 7);
    const idx = monthIndex.get(month);
    if (idx === undefined && month !== window.thisMonth) continue;
    if (idx !== undefined && idx < recordsStart) recordsStart = idx;
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
  if (recordsStart === FIXED_EXPENSE_MONTHS) recordsStart = 0; // 기간 안 매입이 없으면 그대로 12달
  const baseMonths = FIXED_EXPENSE_MONTHS - recordsStart;
  const spent = (v: number) => Math.abs(v) > 0.5;
  for (const row of rows.values()) {
    row.monthsWithSpend = row.perMonth.filter(spent).length;
    row.activeAvg = row.monthsWithSpend ? Math.round(row.total / row.monthsWithSpend) : 0;
    // 중간에 새로 시작해서 그 뒤로 지난달까지 매달 나온 곳(3달 이상)은 시작한 달부터 나눔 — 띄엄띄엄 나온 곳(보험·숙박비)은 그대로
    const first = row.perMonth.findIndex(spent);
    const newRegular =
      first > recordsStart &&
      FIXED_EXPENSE_MONTHS - first >= NEW_REGULAR_MIN_MONTHS &&
      row.perMonth.slice(first).every(spent);
    row.divisor = newRegular ? FIXED_EXPENSE_MONTHS - first : baseMonths;
    row.since = newRegular ? window.months[first] : null;
    row.monthlyAvg = Math.round(row.total / row.divisor);
    row.minMonth = Math.min(...row.perMonth);
    row.maxMonth = Math.max(...row.perMonth);
  }
  const candidateMinMonths = Math.ceil((baseMonths * CANDIDATE_MIN_MONTHS) / FIXED_EXPENSE_MONTHS);
  const all = [...rows.values()];
  const fixed = all.filter((r) => r.fixed).sort(byAvg);
  const notFixed = all.filter((r) => !r.fixed);
  const sumAvg = (list: FixedExpenseRow[]) => list.reduce((sum, r) => sum + r.monthlyAvg, 0);
  const totalMonthly = sumAvg(fixed);
  return {
    window,
    recordsFrom: recordsStart > 0 ? window.months[recordsStart] : null,
    baseMonths,
    candidateMinMonths,
    rows: fixed,
    candidates: notFixed.filter((r) => r.monthsWithSpend >= candidateMinMonths || r.since !== null).sort(byAvg),
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

// ── 예상 세전이익에 남은 달 고정지출(11/4 사용자 결정) — 계산은 lib/projectProfit.ts의 fixedCostOutlook ──
// 지정 줄만, 달 평균은 "이익 기준"(공급가액, 매입세액 불공제 카테고리는 부가세 포함 — vatBasis의 purchaseCostOf)으로 다시 계산한
// 고정지출 표(fixedExpenseLoad.ts)에서 가져옴 — 위 표의 달 평균은 실제로 나간 돈(공급가액 + 부가세)이라 이익에 그대로 쓰면 돌려받는
// 부가세만큼 비용이 커짐.
export type FixedCostRow = { key: string; kind: FixedExpenseKind; id: string; name: string; monthlyAvg: number };

export function fixedCostRows(report: FixedExpenseReport): FixedCostRow[] {
  return report.rows.map((r) => ({ key: r.key, kind: r.kind, id: r.id, name: r.name, monthlyAvg: r.monthlyAvg }));
}

/** 거래가 들어가는 지정 줄 키 — 고정지출 표와 같은 규칙(지정 거래처 → 지정 카테고리, 한 거래는 한 줄에만), 지정 줄이 아니면 null */
export function fixedRowRouter(rows: FixedCostRow[]) {
  const clients = new Set(rows.filter((r) => r.kind === "client").map((r) => r.id));
  const categories = new Set(rows.filter((r) => r.kind === "category").map((r) => r.id));
  return (t: { client_id: string | null; category_id: string | null }) => {
    if (t.client_id && clients.has(t.client_id)) return `client:${t.client_id}`;
    if (t.category_id && categories.has(t.category_id)) return `category:${t.category_id}`;
    return null;
  };
}
