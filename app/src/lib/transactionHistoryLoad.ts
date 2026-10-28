import type { createClient } from "@/lib/supabase/server";
import { kstDateTime } from "@/lib/kstDate";
import { describeChanges, summarizeHistoryTx, type HistoryNames, type HistoryTx } from "@/lib/transactionHistory";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type HistoryEntry = {
  id: number;
  transaction_id: string;
  action: "update" | "delete";
  changed_at: string;
  changed_by: string | null;
  old_row: HistoryTx;
  new_row: HistoryTx | null;
};

// 화면에 보여 줄 이력 한 건 — 시각·누가·수정/삭제·거래 요약(지금 값, 삭제면 지우기 전 값)·바뀐 칸.
export type HistoryView = {
  id: number;
  transactionId: string;
  changedAt: string;
  time: string;
  who: string;
  action: "update" | "delete";
  date: string;
  type: string;
  client: string;
  item: string;
  total: number;
  changes: { label: string; before: string; after: string }[];
};

// 거래 수정 이력(094 SQL) — 실행 전이면 표가 없어 null(화면에서 이력 칸을 숨김). 이름은 id로 저장돼 있어 이력에 나온 것만
// 이름표를 따로 조회(지워진 거래처·프로젝트는 "(지워진 …)"로).
export async function loadTransactionHistory(
  supabase: Supabase,
  opts: { transactionIds?: string[]; limit: number }
): Promise<HistoryView[] | null> {
  let query = supabase.from("transaction_history").select("*").order("changed_at", { ascending: false }).limit(opts.limit);
  if (opts.transactionIds) query = query.in("transaction_id", opts.transactionIds);
  const { data, error } = await query;
  if (error) return null;
  const entries = (data ?? []) as HistoryEntry[];
  if (entries.length === 0) return [];

  const rows = entries.flatMap((e) => (e.new_row ? [e.old_row, e.new_row] : [e.old_row]));
  const idsOf = (key: keyof HistoryTx) =>
    Array.from(new Set(rows.map((r) => r[key]).filter((v): v is string => typeof v === "string" && v.length > 0)));
  const lookup = async (table: string, ids: string[]) => {
    if (ids.length === 0) return new Map<string, string>();
    const { data: found } = await supabase.from(table).select("id, name").in("id", ids);
    return new Map(((found ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  };
  const [clients, projects, categories, paymentMethods, users] = await Promise.all([
    lookup("clients", idsOf("client_id")),
    lookup("projects", idsOf("project_id")),
    lookup("expense_categories", idsOf("category_id")),
    lookup("payment_methods", idsOf("payment_method_id")),
    lookup("users", Array.from(new Set(entries.map((e) => e.changed_by).filter((v): v is string => Boolean(v))))),
  ]);
  const names: HistoryNames = { clients, projects, categories, paymentMethods };

  return entries.map((e) => {
    const shown = e.new_row ?? e.old_row;
    return {
      id: e.id,
      transactionId: e.transaction_id,
      changedAt: e.changed_at,
      time: kstDateTime(e.changed_at),
      who: e.changed_by ? users.get(e.changed_by) ?? "알 수 없는 계정" : "시스템(로그인 없음)",
      action: e.action,
      ...summarizeHistoryTx(shown, names),
      changes: e.new_row ? describeChanges(e.old_row, e.new_row, names) : [],
    };
  });
}
