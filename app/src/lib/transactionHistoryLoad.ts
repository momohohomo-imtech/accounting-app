import type { createClient } from "@/lib/supabase/server";
import { kstDateTime } from "@/lib/kstDate";
import {
  collapseBulkChanges,
  describeChanges,
  summarizeHistoryTx,
  type HistoryNames,
  type HistoryTx,
} from "@/lib/transactionHistory";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type LightEntry = {
  id: number;
  transaction_id: string;
  action: "update" | "delete";
  changed_at: string;
  changed_by: string | null;
};
type HistoryEntry = LightEntry & { old_row: HistoryTx; new_row: HistoryTx | null };

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
  // 지운 거래가 지금 장부에 다시 있음 — 지운 뒤 백업 복원으로 다시 들어간 것(복원 말고는 같은 거래를 되살리는 기능이 없음).
  restored?: boolean;
  // 한꺼번에 바뀐 묶음(lib/transactionHistory.ts의 collapseBulkChanges)의 거래 수 — 묶음 줄은 거래 요약 대신 이 수만,
  // 바뀐 내용은 앞쪽 몇 건에서 본 것.
  bulkCount?: number;
};

// missing: 094 SQL 실행 전이라 이력 표가 없음(화면에서 이력 칸을 숨기거나 안내). error: 그 밖의 조회 실패(안내 문구에 표시) —
// 예전엔 둘 다 "SQL 실행 전"으로 보여서, 실행했는데도 실행하라는 안내가 나올 수 있었음.
export type HistoryLoad = { state: "ok"; rows: HistoryView[] } | { state: "missing" } | { state: "error"; message: string };

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const PAGE = 1000;
// 가벼운 칸만 이만큼까지 훑어서 묶음을 접음 — 거래가 아주 많은 장부를 복원한 직후라도 그 앞의 이력까지 보이게.
const LIGHT_MAX = 5000;
// 묶음 줄의 바뀐 내용·복원 여부는 앞쪽 몇 건만 보고 판단.
const BULK_SAMPLE = 3;
// .in() 목록은 주소(URL)에 들어가서 너무 길어지지 않게 나눠 조회.
const IN_CHUNK = 80;

async function selectIn<T>(supabase: Supabase, table: string, columns: string, column: string, values: (string | number)[]) {
  const unique = Array.from(new Set(values));
  const chunks = Array.from({ length: Math.ceil(unique.length / IN_CHUNK) }, (_, i) => unique.slice(i * IN_CHUNK, (i + 1) * IN_CHUNK));
  const results = await Promise.all(chunks.map((chunk) => supabase.from(table).select(columns).in(column, chunk)));
  return results.flatMap((r) => (r.data ?? []) as T[]);
}

// 거래 수정 이력(094 SQL). 가벼운 칸(누가·언제·무엇을)만 먼저 훑어 한꺼번에 바뀐 묶음을 접고, 보여 줄 limit줄의 내용만 다시
// 조회. 이름은 id로 저장돼 있어 이력에 나온 것만 이름표를 따로 조회(지워진 거래처·프로젝트는 "(지워진 …)"로).
export async function loadTransactionHistory(
  supabase: Supabase,
  opts: { transactionIds?: string[]; limit: number }
): Promise<HistoryLoad> {
  const light: LightEntry[] = [];
  let items: LightEntry[][] = [];
  for (let from = 0; from < LIGHT_MAX; from += PAGE) {
    let query = supabase
      .from("transaction_history")
      .select("id, transaction_id, action, changed_at, changed_by")
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (opts.transactionIds) query = query.in("transaction_id", opts.transactionIds);
    const { data, error } = await query;
    if (error) {
      if (from === 0 && MISSING_TABLE.has(error.code ?? "")) return { state: "missing" };
      return { state: "error", message: error.message };
    }
    light.push(...((data ?? []) as LightEntry[]));
    items = collapseBulkChanges(light);
    // 보여 줄 줄보다 하나 더 모이면 앞의 limit줄은 다 찬 것(묶음은 같은 시각이라 이어져 있음).
    if ((data ?? []).length < PAGE || items.length > opts.limit) break;
  }
  items = items.slice(0, opts.limit);
  if (items.length === 0) return { state: "ok", rows: [] };

  // 끝까지 못 훑었으면 마지막 묶음은 일부만 셌을 수 있어 정확한 수를 따로 셈.
  const bulkCounts = new Map<number, number>(items.filter((list) => list.length > 1).map((list) => [list[0].id, list.length]));
  const last = items[items.length - 1];
  if (light.length >= LIGHT_MAX && last.length > 1) {
    const head = last[0];
    let countQuery = supabase
      .from("transaction_history")
      .select("id", { count: "exact", head: true })
      .eq("action", head.action)
      .eq("changed_at", head.changed_at);
    countQuery = head.changed_by ? countQuery.eq("changed_by", head.changed_by) : countQuery.is("changed_by", null);
    if (opts.transactionIds) countQuery = countQuery.in("transaction_id", opts.transactionIds);
    const { count } = await countQuery;
    if (count) bulkCounts.set(head.id, count);
  }

  const shownEntries = items.flatMap((list) => list.slice(0, BULK_SAMPLE));
  const deletedTxIds = shownEntries.filter((e) => e.action === "delete").map((e) => e.transaction_id);
  const [fullRows, stillThere] = await Promise.all([
    selectIn<HistoryEntry>(supabase, "transaction_history", "*", "id", shownEntries.map((e) => e.id)),
    selectIn<{ id: string }>(supabase, "transactions", "id", "id", deletedTxIds),
  ]);
  const fullById = new Map(fullRows.map((e) => [e.id, e]));
  const existing = new Set(stillThere.map((t) => t.id));

  const rows = fullRows.flatMap((e) => (e.new_row ? [e.old_row, e.new_row] : [e.old_row]));
  const idsOf = (key: keyof HistoryTx) =>
    rows.map((r) => r[key]).filter((v): v is string => typeof v === "string" && v.length > 0);
  const lookup = async (table: string, ids: string[]) =>
    new Map((await selectIn<{ id: string; name: string }>(supabase, table, "id, name", "id", ids)).map((r) => [r.id, r.name]));
  const [clients, projects, categories, paymentMethods, users] = await Promise.all([
    lookup("clients", idsOf("client_id")),
    lookup("projects", idsOf("project_id")),
    lookup("expense_categories", idsOf("category_id")),
    lookup("payment_methods", idsOf("payment_method_id")),
    lookup("users", items.map((list) => list[0].changed_by).filter((v): v is string => Boolean(v))),
  ]);
  const names: HistoryNames = { clients, projects, categories, paymentMethods };
  const changesOf = (e: HistoryEntry) => (e.new_row ? describeChanges(e.old_row, e.new_row, names) : []);

  return {
    state: "ok",
    rows: items.flatMap((list): HistoryView[] => {
      const head = list[0];
      const full = list.slice(0, BULK_SAMPLE).flatMap((e) => fullById.get(e.id) ?? []);
      if (full.length === 0) return [];
      const base = {
        id: head.id,
        changedAt: head.changed_at,
        time: kstDateTime(head.changed_at),
        who: head.changed_by ? users.get(head.changed_by) ?? "알 수 없는 계정" : "시스템(로그인 없음)",
        action: head.action,
        restored: head.action === "delete" && full.some((e) => existing.has(e.transaction_id)),
      };
      if (list.length === 1) {
        const e = full[0];
        return [{ ...base, transactionId: e.transaction_id, ...summarizeHistoryTx(e.new_row ?? e.old_row, names), changes: changesOf(e) }];
      }
      // 묶음 — 앞쪽 몇 건에서 본 바뀐 내용(같은 줄은 한 번만).
      const seen = new Set<string>();
      const changes = full.flatMap(changesOf).filter((c) => {
        const key = `${c.label}|${c.before}|${c.after}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [
        {
          ...base,
          transactionId: "",
          date: "",
          type: "",
          client: "",
          item: "",
          total: 0,
          changes,
          bulkCount: bulkCounts.get(head.id) ?? list.length,
        },
      ];
    }),
  };
}
