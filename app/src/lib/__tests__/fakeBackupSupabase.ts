import type { SupabaseClient } from "@supabase/supabase-js";

// 백업·복원 검사용 가짜 Supabase(실제 자료 아님) — PostgREST처럼 한 번에 1,000줄까지만 돌려주고, 복원 함수(096)는
// 올린 줄을 모았다가 확정 때 표를 통째로 바꿈. 백업 파일·백업 기록·함수 호출을 모아 둠.
export type Row = Record<string, unknown>;
type Opts = {
  missing?: string[];
  noRowCountsColumn?: boolean;
  noRestoreFunctions?: boolean;
  commitError?: string;
};

export function fakeSupabase(tables: Record<string, Row[]>, opts: Opts = {}) {
  const uploads: { name: string; json: string }[] = [];
  const records: Row[] = [];
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const staged = new Map<string, { table: string; rows: Row[] }[]>();
  const client = {
    from(table: string) {
      const orders: string[] = [];
      const builder = {
        order(key: string) {
          orders.push(key);
          return builder;
        },
        range(from: number, to: number) {
          if (opts.missing?.includes(table)) {
            return Promise.resolve({ data: null, error: { code: "PGRST205", message: `no table ${table}` } });
          }
          const key = (r: Row) => orders.map((k) => String(r[k])).join("|");
          const sorted = [...(tables[table] ?? [])].sort((a, b) => key(a).localeCompare(key(b)));
          return Promise.resolve({ data: sorted.slice(from, Math.min(to + 1, from + 1000)), error: null });
        },
      };
      return {
        select() {
          return builder;
        },
        insert(rows: Row | Row[]) {
          const list = Array.isArray(rows) ? rows : [rows];
          if (opts.noRowCountsColumn && list.some((r) => "row_counts" in r)) {
            return Promise.resolve({ error: { code: "PGRST204", message: "no row_counts column" } });
          }
          records.push(...list);
          return Promise.resolve({ error: null });
        },
      };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      if (opts.noRestoreFunctions) {
        return Promise.resolve({ data: null, error: { code: "PGRST202", message: `Could not find the function public.${fn}` } });
      }
      const id = String(args.p_restore_id);
      if (fn === "restore_stage") {
        staged.set(id, [...(staged.get(id) ?? []), { table: String(args.p_table), rows: args.p_rows as Row[] }]);
      } else if (fn === "restore_discard") {
        staged.delete(id);
      } else if (fn === "restore_commit") {
        if (opts.commitError) return Promise.resolve({ data: null, error: { message: opts.commitError } });
        const counts = args.p_counts as Record<string, number>;
        const parts = staged.get(id) ?? [];
        for (const [table, count] of Object.entries(counts)) {
          const rows = parts.filter((p) => p.table === table).flatMap((p) => p.rows);
          if (rows.length !== count) {
            return Promise.resolve({ data: null, error: { message: `${table} 표 자료가 다 올라오지 않았습니다` } });
          }
        }
        for (const table of Object.keys(counts)) tables[table] = parts.filter((p) => p.table === table).flatMap((p) => p.rows);
        staged.delete(id);
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from() {
        return {
          upload(name: string, json: string) {
            uploads.push({ name, json });
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };
  return { supabase: client as unknown as SupabaseClient, uploads, records, calls, tables, staged };
}

export const txRows = (n: number, extra: Row = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${String(i).padStart(5, "0")}`, purchase_amount: 1000, ...extra }));
