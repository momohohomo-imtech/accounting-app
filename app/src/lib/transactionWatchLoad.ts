import type { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/relations";
import { transactionTotal } from "@/lib/credit";
import type { WatchRow } from "@/lib/transactionWatch";

// 매입매출 "챙길 거래" 창 불러오기(105 SQL transaction_watch) — 표가 없으면(실행 전) ready=false라 창과 📌 칸을 숨김.
// 다른 오류는 error로 알려 줌(창에 안내). 거래 내용(날짜·거래처·품목·금액·프로젝트)을 같이 읽어 창에 바로 씀 — 달·필터와 상관없이
// 올린 거래 전부(그래서 달을 바꿔도 창은 그대로). 줄이 1,000개를 넘어도 끝까지(페이지 나눔 — fetchAllRows와 같은 방식, 표 없음
// 오류 코드를 보려고 따로 둠).
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const PAGE_SIZE = 1000;

export type TransactionWatchLoad = { ready: boolean; rows: WatchRow[]; error: string | null };

type RawWatch = {
  id: string;
  transaction_id: string;
  memo: string | null;
  created_at: string;
  transactions: unknown;
};
type RawTx = {
  id: string;
  trans_date: string;
  type: string;
  item_name: string | null;
  client_name_raw: string | null;
  payment_group_id?: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
  clients: unknown;
  projects: unknown;
};

export async function loadTransactionWatch(supabase: SupabaseClient): Promise<TransactionWatchLoad> {
  const raw: RawWatch[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transaction_watch")
      // payment_group_id는 092 SQL 칸 — "*"로 읽어서 092 실행 전이어도 오류가 안 나게
      .select("id, transaction_id, memo, created_at, transactions(*, clients(name), projects(name))")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (MISSING_TABLE.has(error.code ?? "")) return { ready: false, rows: [], error: null };
      return { ready: true, rows: [], error: error.message };
    }
    raw.push(...((data ?? []) as RawWatch[]));
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const rows: WatchRow[] = [];
  for (const w of raw) {
    const t = one(w.transactions as RawTx | RawTx[] | null);
    if (!t) continue; // 볼 수 없는 거래(권한) — 건너뜀
    rows.push({
      id: w.id,
      transaction_id: w.transaction_id,
      memo: w.memo,
      created_at: w.created_at,
      tx: {
        id: t.id,
        trans_date: t.trans_date,
        type: t.type,
        item_name: t.item_name,
        client_name: (one(t.clients as { name: string } | { name: string }[] | null)?.name ?? t.client_name_raw ?? "").trim(),
        project_name: one(t.projects as { name: string } | { name: string }[] | null)?.name ?? null,
        amount: transactionTotal({
          type: t.type,
          sales_amount: Number(t.sales_amount),
          sales_vat: Number(t.sales_vat),
          purchase_amount: Number(t.purchase_amount),
          purchase_vat: Number(t.purchase_vat),
        }),
        payment_group_id: t.payment_group_id ?? null,
      },
    });
  }
  return { ready: true, rows, error: null };
}
