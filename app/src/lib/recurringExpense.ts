// 고정지출 자동 등록(사용자 요청 11/23 "매달 고정 지출 작성 항 → 결제일에 매입장에 자동으로, 올릴 때는 분류대기", 108 SQL, 사용자 결정
// "추천대로"). 어느 달 몫을 언제 올릴지·올릴 금액만 여기서 정함(화면 표시·크론·"지금 올리기" 공용). 올리기는 DB 함수
// post_recurring_expense(올린 기록 + 매입 한 줄을 한 번에 — 같은 달 두 번 안 올라감). 검사: recurringExpense.test.ts
//
// 규칙:
//  - 결제일 = 매달 pay_day일, 그 달에 없는 날이면 말일(31일 → 2월 28·29일). 주말·공휴일이어도 그날 날짜(사용자 결정)
//  - 오늘(한국 시각)이 결제일이거나 지났으면 올림 — 서버가 며칠 못 돌아도 그 달 결제일 날짜로 올림, 지난달 몫까지 따라잡음(그 전 달은
//    자동으로 안 올림 — 오래 멈춘 뒤 한꺼번에 쏟아지지 않게, 화면에 "지난 결제일" 안내)
//  - 시작일(비우면 항목을 만든 날)보다 앞선 결제일은 안 올림 — 만들자마자 이미 지난 이번 달 몫이 올라가지 않게(이미 직접 넣었을 수 있음)
//  - 끝나는 날이 지난 결제일·일시 중지한 항목은 안 올림
//  - 금액은 예상 금액(매달 다른 항목은 분류할 때 실제 금액으로 고침 — 사용자 결정). 부가세 별도면 10% 더함(거래 등록과 같은 계산)
import { addedVat } from "@/lib/vatBasis";

export type RecurringExpense = {
  id: string;
  name: string;
  pay_day: number;
  client_id: string | null;
  client_name_raw: string | null;
  item_name: string | null;
  amount: number;
  add_vat: boolean;
  tax_invoice_issued: boolean;
  payment_method_id: string | null;
  category_id: string | null;
  start_date: string | null;
  end_date: string | null;
  paused: boolean;
  memo: string | null;
  created_at: string;
};

/** 자동으로 올린 매입 줄의 메모1 — 장부에서 알아보는 표시이자, 은행 "등록" 때 겹침을 찾는 표시(lib/actions/bank.ts) */
export const RECURRING_NOTE_PREFIX = "[고정지출 자동]";

export function recurringNote(name: string) {
  return `${RECURRING_NOTE_PREFIX} ${name.trim()}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-01" */
export function monthStart(year: number, month: number) {
  return `${year}-${pad(month)}-01`;
}

/** 그 달의 결제일 "YYYY-MM-DD" — 없는 날이면 말일 */
export function scheduledDate(year: number, month: number, payDay: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Math.floor(payDay)), last);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** 저장 시각(UTC ISO) → 한국 날짜 "YYYY-MM-DD" */
export function kstDateOf(iso: string) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? new Date(t + 9 * 3600_000).toISOString().slice(0, 10) : "";
}

/** 이 날짜부터의 결제일만 — 시작일, 비었으면 항목을 만든 날(한국 날짜) */
export function startBoundary(r: Pick<RecurringExpense, "start_date" | "created_at">) {
  return r.start_date ? r.start_date.slice(0, 10) : kstDateOf(r.created_at);
}

function inRange(r: Pick<RecurringExpense, "start_date" | "end_date" | "created_at">, date: string) {
  if (date < startBoundary(r)) return false;
  return !r.end_date || date <= r.end_date.slice(0, 10);
}

export type DuePost = { month: string; date: string };

/**
 * 지금 올려야 할 달 몫(지난달·이번 달 중 결제일이 오늘이거나 지났고 아직 안 올린 것) — 날짜 순.
 * postedMonths: 이 항목의 올린 기록(달 1일 "YYYY-MM-01").
 */
export function duePosts(r: RecurringExpense, today: string, postedMonths: ReadonlySet<string>): DuePost[] {
  if (r.paused || !(r.amount !== 0)) return [];
  const [y, m] = today.split("-").map(Number);
  const months = [prevMonth(y, m), { year: y, month: m }];
  const out: DuePost[] = [];
  for (const mm of months) {
    const month = monthStart(mm.year, mm.month);
    const date = scheduledDate(mm.year, mm.month, r.pay_day);
    if (date > today || postedMonths.has(month) || !inRange(r, date)) continue;
    out.push({ month, date });
  }
  return out;
}

/** 올릴 금액 — 부가세 별도면 10%를 더함(거래 등록 computeAmounts와 같음) */
export function postAmounts(r: Pick<RecurringExpense, "amount" | "add_vat">) {
  return { purchase_amount: r.amount, purchase_vat: r.add_vat ? addedVat(r.amount) : 0, vat_included: r.add_vat };
}

/** 장부에 들어갈 합계(부가세 포함) */
export function postTotal(r: Pick<RecurringExpense, "amount" | "add_vat">) {
  const a = postAmounts(r);
  return a.purchase_amount + a.purchase_vat;
}

export type RecurringStatus =
  | { kind: "paused" }
  | { kind: "ended" }
  | { kind: "posted"; date: string }
  | { kind: "scheduled"; date: string }
  | { kind: "due"; date: string }
  | { kind: "notStarted"; date: string };

/**
 * 탭 표의 "이번 달" 칸 — 올림(○일) / 예정(○일) / 올릴 차례(결제일이 됐는데 아직 — 매일 아침 서버가 올리고, "지금 올리기"로 바로도) /
 * 시작 전(다음 결제일) / 끝남 / 일시 중지.
 */
export function currentStatus(r: RecurringExpense, today: string, postedMonths: ReadonlySet<string>): RecurringStatus {
  if (r.paused) return { kind: "paused" };
  const due = duePosts(r, today, postedMonths);
  if (due.length > 0) return { kind: "due", date: due[0].date };
  const [y, m] = today.split("-").map(Number);
  const date = scheduledDate(y, m, r.pay_day);
  if (postedMonths.has(monthStart(y, m))) return { kind: "posted", date };
  const next = nextScheduled(r, today);
  if (next === null) return { kind: "ended" };
  if (date > today && inRange(r, date)) return { kind: "scheduled", date };
  return { kind: "notStarted", date: next };
}

/** 다음 결제일(오늘 이후, 시작일·끝나는 날 안) — 없으면 null. 화면 "다음 등록" 칸. */
export function nextScheduled(r: RecurringExpense, today: string): string | null {
  if (r.paused) return null;
  let [y, m] = today.split("-").map(Number);
  for (let i = 0; i < 24; i++) {
    const date = scheduledDate(y, m, r.pay_day);
    if (date > today && date >= startBoundary(r)) return r.end_date && date > r.end_date.slice(0, 10) ? null : date;
    ({ year: y, month: m } = nextMonth(y, m));
  }
  return null;
}

/** 지난달보다 앞선 달인데 올린 기록이 없는 결제일 수(자동으로 안 올림 — 화면 안내용), 최근 12달까지만 셈 */
export function missedOlderCount(r: RecurringExpense, today: string, postedMonths: ReadonlySet<string>): number {
  if (r.paused) return 0;
  let [y, m] = today.split("-").map(Number);
  ({ year: y, month: m } = prevMonth(y, m));
  let count = 0;
  for (let i = 0; i < 12; i++) {
    ({ year: y, month: m } = prevMonth(y, m));
    const date = scheduledDate(y, m, r.pay_day);
    if (inRange(r, date) && !postedMonths.has(monthStart(y, m))) count += 1;
  }
  return count;
}

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** "이번 달" 칸 글자 */
export function statusLabel(s: RecurringStatus): string {
  switch (s.kind) {
    case "paused":
      return "일시 중지";
    case "ended":
      return "끝남";
    case "posted":
      return `올림 · ${shortDate(s.date)}`;
    case "scheduled":
      return `예정 · ${shortDate(s.date)}`;
    case "due":
      return `올릴 차례 · ${shortDate(s.date)}`;
    case "notStarted":
      return `시작 전 · 다음 ${shortDate(s.date)}`;
  }
}

/**
 * 은행 "등록" 때 겹침 확인(사용자 결정 "같은 날·같은 금액의 고정지출 줄이 있으면 알림") — 자동으로 올린 매입 줄(메모1 표시) 중
 * 같은 날·같은 합계(부가세 포함)인 것. 은행 출금은 합계 금액 하나라 장부 줄의 공급가액 + 부가세와 비교.
 */
export function isRecurringDuplicate(
  ledger: { type: string; trans_date: string; purchase_amount: number; purchase_vat: number; note1: string | null },
  bank: { trans_date: string; amount: number }
) {
  return (
    ledger.type === "매입" &&
    String(ledger.trans_date).slice(0, 10) === String(bank.trans_date).slice(0, 10) &&
    Number(ledger.purchase_amount) + Number(ledger.purchase_vat) === Number(bank.amount) &&
    (ledger.note1 ?? "").startsWith(RECURRING_NOTE_PREFIX)
  );
}
