import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { BACKUP_TABLES, decodeBackupFile, runBackup } from "@/lib/backup";
import { fakeSupabase, txRows, type Row } from "./fakeBackupSupabase";

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

test("백업: 공사 메모·일용직 사용내역·발주서 등 앱이 쓰는 표를 전부 담고, 고유 칸이 둘인 표도 끝까지", async () => {
  for (const t of ["construction_memos", "daily_worker_usage_logs", "quality_checklist_items", "tools", "tool_checklists",
    "tool_checklist_items", "purchase_orders", "purchase_order_items", "know_how_notes", "vat_prepayment_notices",
    "half_year_settlements", "work_log_summary_checks", "dashboard_page_memo", "transactions_page_memo", "projects_page_memo"]) {
    assert.ok(BACKUP_TABLES.includes(t), `${t} 백업 대상`);
  }
  // 예정고지액은 (연도, 월)이 고유 — 1,000줄이 넘어도 겹치거나 빠지지 않게 두 칸으로 정렬해서 나눠 받음
  const notices = Array.from({ length: 1500 }, (_, i) => ({ year: 2000 + Math.floor(i / 2), month: i % 2 ? 10 : 4, amount: i }));
  const fake = fakeSupabase({ vat_prepayment_notices: notices });
  await runBackup(fake.supabase, "manual");
  const dump = JSON.parse(fake.uploads[0].json);
  assert.equal(new Set(dump.vat_prepayment_notices.map((r: Row) => `${r.year}-${r.month}`)).size, 1500);
});

test("백업 파일: 압축(.json.gz)으로 올리고, 압축본·예전 JSON(들여쓰기) 둘 다 읽음", async () => {
  const fake = fakeSupabase({ transactions: txRows(2000, { note1: "가짜 메모 ".repeat(5) }) });
  const { fileName, sizeMb } = await runBackup(fake.supabase, "auto");
  assert.match(fileName, /^backup-.*\.json\.gz$/);
  assert.equal(fake.uploads[0].contentType, "application/gzip");
  const plainBytes = new TextEncoder().encode(fake.uploads[0].json).byteLength;
  assert.ok(fake.uploads[0].bytes * 5 < plainBytes, `압축: ${fake.uploads[0].bytes} < ${plainBytes}/5`);
  assert.equal(Number(fake.records[0].file_size_mb), Number(sizeMb.toFixed(3)));
  assert.equal(JSON.parse(fake.uploads[0].json).transactions.length, 2000);
  // 예전 백업(들여쓰기 JSON)과 압축본을 같은 함수로
  const dump = { clients: [{ id: "c1", name: "가짜 거래처" }] };
  const legacy = new TextEncoder().encode(JSON.stringify(dump, null, 2));
  assert.deepEqual(JSON.parse(decodeBackupFile(legacy)), dump);
  assert.deepEqual(JSON.parse(decodeBackupFile(gzipSync(Buffer.from(JSON.stringify(dump))))), dump);
});

test("백업: 표를 몇 개씩 동시에 읽어도 표 순서·내용은 그대로", async () => {
  const tables = Object.fromEntries(BACKUP_TABLES.map((t, i) => [t, txRows(i % 3 === 0 ? 1200 : 2)]));
  const fake = fakeSupabase(tables);
  const { rowCounts } = await runBackup(fake.supabase, "manual");
  const dump = JSON.parse(fake.uploads[0].json);
  assert.deepEqual(Object.keys(dump).filter((k) => k !== "__meta"), BACKUP_TABLES);
  for (const [i, t] of BACKUP_TABLES.entries()) assert.equal(rowCounts[t], i % 3 === 0 ? 1200 : 2, t);
});
