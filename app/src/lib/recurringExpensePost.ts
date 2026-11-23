// 고정지출 자동 등록 — 결제일이 된 항목을 매입장에 올림(108 SQL post_recurring_expense). 매일 아침 크론(/api/cron/recurring-expenses,
// 서버 열쇠)과 "고정지출" 탭의 "지금 올리기"(관리자·직원 본인 권한)가 같이 씀. 어느 달 몫을 올릴지는 lib/recurringExpense.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { duePosts, monthStart, postAmounts, recurringNote, type RecurringExpense } from "@/lib/recurringExpense";

export const RECURRING_SELECT =
  "id, name, pay_day, client_id, client_name_raw, item_name, amount, add_vat, tax_invoice_issued, payment_method_id, category_id, start_date, end_date, paused, memo, created_at";

// SQL 108 실행 전(표 없음)
export const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

/** 108 SQL을 실행했는지(표가 있는지) — 매입매출 "고정지출" 탭을 보일지. 다른 오류면 보이게 둠(탭 안에서 오류가 보임). */
export async function recurringTableReady(supabase: SupabaseClient) {
  const { error } = await supabase.from("recurring_expenses").select("id").limit(1);
  return !error || !MISSING_TABLE.has(error.code ?? "");
}

export type RecurringPost = { recurring_expense_id: string; month: string; transaction_id: string | null; posted_at: string };

/** 항목 전부 + 올린 기록(fromMonth 이후만 — 비우면 전부) */
export async function loadRecurring(
  supabase: SupabaseClient,
  fromMonth?: string
): Promise<{ missing: true } | { missing: false; items: RecurringExpense[]; posts: RecurringPost[] }> {
  const { data, error } = await supabase.from("recurring_expenses").select(RECURRING_SELECT).order("pay_day").order("name").order("id");
  if (error) {
    if (MISSING_TABLE.has(error.code ?? "")) return { missing: true };
    throw new Error(`고정지출 항목을 불러오지 못했습니다: ${error.message}`);
  }
  const posts = await fetchAllRows<RecurringPost>((from, to) => {
    let q = supabase.from("recurring_expense_posts").select("recurring_expense_id, month, transaction_id, posted_at");
    if (fromMonth) q = q.gte("month", fromMonth);
    return q.order("id", { ascending: true }).range(from, to);
  });
  const items = (data ?? []).map((r) => ({ ...r, amount: Number(r.amount), pay_day: Number(r.pay_day) })) as RecurringExpense[];
  return { missing: false, items, posts };
}

export function postedMonthsByItem(posts: RecurringPost[]) {
  const map = new Map<string, Set<string>>();
  for (const p of posts) {
    const set = map.get(p.recurring_expense_id) ?? new Set<string>();
    set.add(String(p.month).slice(0, 10));
    map.set(p.recurring_expense_id, set);
  }
  return map;
}

export type PostResult = {
  missing?: boolean;
  posted: { name: string; date: string }[];
  failed: { name: string; date: string; error: string }[];
};

/** 오늘(한국 날짜 "YYYY-MM-DD") 기준으로 올릴 차례인 것을 모두 올림 — 지난달 1일 이후 기록만 보면 충분(그 전 달은 자동으로 안 올림). */
export async function postDueRecurring(supabase: SupabaseClient, today: string): Promise<PostResult> {
  const [y, m] = today.split("-").map(Number);
  const prev = m === 1 ? monthStart(y - 1, 12) : monthStart(y, m - 1);
  const loaded = await loadRecurring(supabase, prev);
  if (loaded.missing) return { missing: true, posted: [], failed: [] };
  const postedByItem = postedMonthsByItem(loaded.posts);
  const result: PostResult = { posted: [], failed: [] };
  for (const item of loaded.items) {
    for (const due of duePosts(item, today, postedByItem.get(item.id) ?? new Set())) {
      const amounts = postAmounts(item);
      const { data, error } = await supabase.rpc("post_recurring_expense", {
        p_recurring_id: item.id,
        p_month: due.month,
        p_trans_date: due.date,
        p_purchase_amount: amounts.purchase_amount,
        p_purchase_vat: amounts.purchase_vat,
        p_vat_included: amounts.vat_included,
        p_note1: recurringNote(item.name),
      });
      if (error) result.failed.push({ name: item.name, date: due.date, error: error.message });
      else if (data) result.posted.push({ name: item.name, date: due.date });
      // data가 null이면 그 사이 다른 쪽(크론·"지금 올리기")이 먼저 올렸거나 일시 중지됨 — 건너뜀
    }
  }
  return result;
}
