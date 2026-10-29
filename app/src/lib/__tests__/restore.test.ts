import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { BACKUP_TABLES } from "@/lib/backup";
import { RESTORE_TABLES, chunkRows, restoreBlockReason, restoreFromBackup, restoreTablesOf } from "@/lib/restore";
import { fakeSupabase, txRows } from "./fakeBackupSupabase";

const meta = (counts: Record<string, number>) => ({ complete: true, row_counts: counts });

test("복원 표 목록이 SQL의 restore_allowed_tables()(가장 최근에 다시 만든 SQL)와 같음 — 회사 정보만 빼고 백업하는 표 전부", () => {
  const dir = new URL("../../../../supabase/", import.meta.url);
  const latest = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .filter((sql) => sql.includes("function public.restore_allowed_tables()"))
    .at(-1);
  assert.ok(latest, "restore_allowed_tables()를 만드는 SQL이 있어야 함");
  const body = latest.slice(latest.indexOf("function public.restore_allowed_tables()"));
  const list = body.slice(body.indexOf("array["), body.indexOf("]::text[]"));
  const sqlTables = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...sqlTables].sort(), [...RESTORE_TABLES].sort());
  assert.deepEqual(
    BACKUP_TABLES.filter((t) => !RESTORE_TABLES.includes(t)),
    ["company_profiles"]
  );
});

test("복원 막기: 예전 방식 백업은 1,000줄 이상인 표가 있으면 잘린 것으로 보고 막음", () => {
  assert.match(restoreBlockReason({ transactions: txRows(1000) }) ?? "", /transactions/);
  assert.equal(restoreBlockReason({ transactions: txRows(999) }), null);
  // 새 방식은 줄 수가 기록과 같으면 통과, 다르면(파일 손상) 막음
  assert.equal(restoreBlockReason({ transactions: txRows(2500), __meta: meta({ transactions: 2500 }) }), null);
  assert.match(restoreBlockReason({ transactions: txRows(2400), __meta: meta({ transactions: 2500 }) }) ?? "", /손상/);
  assert.match(
    restoreBlockReason({ construction_memos: [], __meta: meta({ construction_memos: 3 }) }) ?? "",
    /construction_memos/
  );
});

test("복원할 표: 새 방식은 백업 때 있던 표만(회사 정보 제외), 예전 방식은 그때 복원하던 22개 표 중 파일에 있는 표만", () => {
  const dump = { transactions: [], construction_memos: [], company_profiles: [], __meta: meta({ transactions: 0, construction_memos: 0, company_profiles: 0 }) };
  assert.deepEqual(restoreTablesOf(dump), ["transactions", "construction_memos"]);
  // 예전 방식: 견적서 표가 생기기 전 백업이면 견적서는 안 건드림, 출장일지·공사 메모는 예전처럼 안 바꿈
  const legacy = restoreTablesOf({ transactions: [], clients: [], trip_logs: [], construction_memos: [] });
  assert.deepEqual(legacy, ["clients", "transactions"]);
});

test("나눠 올리기: 500줄씩, 영수증 원문처럼 큰 줄은 약 1MB씩", () => {
  assert.deepEqual(chunkRows(txRows(1201)).map((c) => c.length), [500, 500, 201]);
  const big = txRows(5, { ocr_extracted_raw: "가".repeat(150_000) }); // 한 줄 약 450KB
  assert.deepEqual(chunkRows(big).map((c) => c.length), [2, 2, 1]);
  const huge = txRows(2, { ocr_extracted_raw: "x".repeat(2_000_000) });
  assert.deepEqual(chunkRows(huge).map((c) => c.length), [1, 1]);
  assert.deepEqual(chunkRows([]), []);
});

test("복원: 나눠 올리고 → 직전 상태를 백업하고 → 한 번에 바꿈", async () => {
  const fake = fakeSupabase({ transactions: txRows(10), construction_memos: [{ id: "m1" }] });
  await restoreFromBackup(fake.supabase, {
    transactions: txRows(2300),
    clients: [{ id: "c1" }],
    __meta: meta({ transactions: 2300, clients: 1 }),
  });
  assert.equal(fake.tables.transactions.length, 2300);
  assert.deepEqual(fake.tables.clients, [{ id: "c1" }]);
  // 백업에 없던 공사 메모는 그대로
  assert.deepEqual(fake.tables.construction_memos, [{ id: "m1" }]);
  const stages = fake.calls.filter((c) => c.fn === "restore_stage");
  assert.deepEqual(
    stages.map((c) => [c.args.p_table, (c.args.p_rows as unknown[]).length]),
    [["clients", 1], ["transactions", 500], ["transactions", 500], ["transactions", 500], ["transactions", 500], ["transactions", 300]]
  );
  const commit = fake.calls.find((c) => c.fn === "restore_commit");
  assert.deepEqual(commit?.args.p_counts, { clients: 1, transactions: 2300 });
  assert.equal(new Set(fake.calls.map((c) => c.args.p_restore_id)).size, 1);
  // 바꾸기 직전 안전용 백업(지금 상태 10줄)
  assert.equal(fake.uploads.length, 1);
  assert.equal(JSON.parse(fake.uploads[0].json).transactions.length, 10);
  assert.equal(fake.calls.some((c) => c.fn === "restore_discard"), false);
});

test("복원: 잘린 백업은 아무것도 올리거나 백업하지 않고 막음", async () => {
  const fake = fakeSupabase({ transactions: txRows(1500) });
  await assert.rejects(() => restoreFromBackup(fake.supabase, { transactions: txRows(1000) }), /잘렸을 수/);
  assert.equal(fake.tables.transactions.length, 1500);
  assert.equal(fake.uploads.length, 0);
  assert.equal(fake.calls.length, 0);
});

test("복원: 096 SQL 실행 전이면 안내하고, 지금 자료·백업 파일은 그대로", async () => {
  const fake = fakeSupabase({ transactions: txRows(3) }, { noRestoreFunctions: true });
  await assert.rejects(
    () => restoreFromBackup(fake.supabase, { transactions: txRows(2), __meta: meta({ transactions: 2 }) }),
    /096 SQL/
  );
  assert.equal(fake.tables.transactions.length, 3);
  assert.equal(fake.uploads.length, 0);
});

test("복원: 한 번에 바꾸기가 실패하면 올린 자료를 정리하고 '그대로'라고 알림", async () => {
  const fake = fakeSupabase({ transactions: txRows(3) }, { commitError: "가짜 오류" });
  await assert.rejects(
    () => restoreFromBackup(fake.supabase, { transactions: txRows(2), __meta: meta({ transactions: 2 }) }),
    /지금 자료는 그대로입니다.*가짜 오류/
  );
  assert.equal(fake.tables.transactions.length, 3);
  assert.equal(fake.calls.at(-1)?.fn, "restore_discard");
  assert.equal(fake.staged.size, 0);
});
