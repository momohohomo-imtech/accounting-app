import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runBackup } from "@/lib/backup";
import { restoreBlockReason, restoreFromBackup } from "@/lib/restore";

// 가짜 Supabase(실제 자료 아님) — PostgREST처럼 한 번에 1,000줄까지만 돌려줌. 백업 파일·백업 기록·복원으로 넣은 줄을 모음.
type Row = Record<string, unknown>;
function fakeSupabase(tables: Record<string, Row[]>, opts: { missing?: string[]; noRowCountsColumn?: boolean } = {}) {
  const uploads: { name: string; json: string }[] = [];
  const records: Row[] = [];
  const inserts: { table: string; count: number }[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            order(key: string) {
              return {
                range(from: number, to: number) {
                  if (opts.missing?.includes(table)) {
                    return Promise.resolve({ data: null, error: { code: "PGRST205", message: `no table ${table}` } });
                  }
                  const sorted = [...(tables[table] ?? [])].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
                  return Promise.resolve({ data: sorted.slice(from, Math.min(to + 1, from + 1000)), error: null });
                },
              };
            },
          };
        },
        insert(rows: Row | Row[]) {
          const list = Array.isArray(rows) ? rows : [rows];
          if (table === "backups") {
            if (opts.noRowCountsColumn && list.some((r) => "row_counts" in r)) {
              return Promise.resolve({ error: { code: "PGRST204", message: "no row_counts column" } });
            }
            records.push(...list);
            return Promise.resolve({ error: null });
          }
          inserts.push({ table, count: list.length });
          tables[table] = [...(tables[table] ?? []), ...list];
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            not() {
              tables[table] = [];
              return Promise.resolve({ error: null });
            },
          };
        },
        update() {
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
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
  return { supabase: client as unknown as SupabaseClient, uploads, records, inserts, tables };
}

const txRows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${String(i).padStart(5, "0")}`, purchase_amount: 1000 }));

test("백업: 1,000줄이 넘는 표도 끝까지 담고, 표별 줄 수를 파일과 기록에 남김", async () => {
  const fake = fakeSupabase({ transactions: txRows(2500), clients: [{ id: "c1" }] });
  const { rowCounts } = await runBackup(fake.supabase, "auto");
  const dump = JSON.parse(fake.uploads[0].json);
  assert.equal(dump.transactions.length, 2500);
  assert.equal(new Set(dump.transactions.map((t: Row) => t.id)).size, 2500);
  assert.equal(dump.__meta.complete, true);
  assert.equal(dump.__meta.row_counts.transactions, 2500);
  assert.equal(rowCounts.clients, 1);
  assert.deepEqual(fake.records[0].row_counts, rowCounts);
});

test("백업: SQL 실행 전이라 없는 표는 건너뛰고, 줄 수 칸이 없으면 빼고 기록", async () => {
  const fake = fakeSupabase({ transactions: txRows(3) }, { missing: ["company_profiles"], noRowCountsColumn: true });
  await runBackup(fake.supabase, "manual");
  const dump = JSON.parse(fake.uploads[0].json);
  assert.deepEqual(dump.company_profiles, []);
  assert.equal("company_profiles" in dump.__meta.row_counts, false);
  assert.equal(fake.records.length, 1);
  assert.equal("row_counts" in fake.records[0], false);
});

test("복원 막기: 예전 방식 백업은 1,000줄 이상인 표가 있으면 잘린 것으로 보고 막음", () => {
  assert.match(restoreBlockReason({ transactions: txRows(1000) }) ?? "", /transactions/);
  assert.equal(restoreBlockReason({ transactions: txRows(999) }), null);
  // 새 방식은 줄 수가 기록과 같으면 통과, 다르면(파일 손상) 막음
  const meta = (n: number) => ({ complete: true, row_counts: { transactions: n } });
  assert.equal(restoreBlockReason({ transactions: txRows(2500), __meta: meta(2500) }), null);
  assert.match(restoreBlockReason({ transactions: txRows(2400), __meta: meta(2500) }) ?? "", /손상/);
});

test("복원: 막힌 백업은 아무것도 지우지 않고, 새 방식 백업은 500줄씩 나눠 끝까지 넣음", async () => {
  const blocked = fakeSupabase({ transactions: txRows(1500) });
  await assert.rejects(() => restoreFromBackup(blocked.supabase, { transactions: txRows(1000) }));
  assert.equal(blocked.tables.transactions.length, 1500);
  assert.equal(blocked.uploads.length, 0);

  const fake = fakeSupabase({ transactions: txRows(10) });
  await restoreFromBackup(fake.supabase, {
    transactions: txRows(2300),
    __meta: { complete: true, row_counts: { transactions: 2300 } },
  });
  assert.equal(fake.tables.transactions.length, 2300);
  assert.deepEqual(
    fake.inserts.filter((i) => i.table === "transactions").map((i) => i.count),
    [500, 500, 500, 500, 300]
  );
  // 복원 직전 안전용 백업(지금 상태 10줄)도 남김
  assert.equal(JSON.parse(fake.uploads[0].json).transactions.length, 10);
});
