import { gunzipSync, gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backupsToPrune, type RetentionRecord } from "@/lib/backupRetention";

// 백업할 표 — 앱이 쓰는 표는 전부(새 표를 만들면 여기와 supabase/096의 restore_allowed_tables()에 같이 넣을 것 — 예전엔
// 공사 메모·일용직 사용내역 등이 빠져 있어 백업으로 되살릴 수 없었고, 복원 때 프로젝트를 지우면서 같이 지워졌음).
// 계정(users)·백업 기록(backups)·거래 수정 이력(transaction_history)은 담지 않음.
export const BACKUP_TABLES = [
  "clients",
  "sites",
  "projects",
  "payment_methods",
  "expense_categories",
  "transactions",
  "credit_payments",
  "work_logs",
  "employees",
  "payroll",
  "daily_worker_offices",
  "daily_workers",
  "daily_worker_usage_logs",
  "access_lists",
  "access_list_workers",
  "bank_accounts",
  "bank_transactions",
  "memos",
  "business_trip_logs",
  "project_agency_purchases",
  // 파일 자체(storage 버킷 내용)는 백업 안 됨 — 이 목록은 메타데이터(파일명/경로)만 담음.
  "attachments",
  "quotes",
  "quote_items",
  // 견적서 공급자 목록 — 설정값이라 백업 파일에만 담고 복원(lib/restore.ts)은 건드리지 않음.
  "company_profiles",
  "trip_logs",
  "trip_log_days",
  "construction_memos",
  "construction_stages",
  "quality_checklist_items",
  "tools",
  "tool_checklists",
  "tool_checklist_items",
  "purchase_orders",
  "purchase_order_items",
  "know_how_notes",
  "vat_prepayment_notices",
  "half_year_settlements",
  "work_log_summary_checks",
  "dashboard_page_memo",
  "transactions_page_memo",
  "projects_page_memo",
  // 097 SQL — 통장 잔액 확인 기록, 신고 끝난 해 잠금(잠금은 백업 파일에만 담고 복원하지 않음 — lib/restore.ts).
  "bank_balance_checks",
  "locked_years",
  // 098 SQL — 공사 작업 순서(순서표·단계)
  "work_sequences",
  "work_sequence_steps",
  // 104 SQL — 메모장 구분 목록(이름·색·순서). 메모에는 구분 이름이 글자로 들어 있어 이 표가 없는 예전 백업도 그대로 복원됨.
  "memo_categories",
  // 105 SQL — 매입매출 "챙길 거래" 창(거래 하나당 한 줄 + 짧은 메모). 이 표가 없는 예전 백업을 복원하면 복원 함수가 지금 목록을
  // 보관했다 되돌림(복원 뒤에도 있는 거래만).
  "transaction_watch",
];

// 표마다 겹치지 않게 나눠 받을 고유 칸(대부분 id).
const ORDER_KEY: Record<string, string[]> = {
  trip_logs: ["project_id"],
  vat_prepayment_notices: ["year", "month"],
  locked_years: ["year"],
};
const PAGE_SIZE = 1000;
// SQL 실행 전이라 아직 없는 표만 건너뜀 — 다른 오류는 백업 실패로(일부만 담긴 백업을 남기지 않게).
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

// 표 하나를 끝까지 — PostgREST는 한 번에 1,000줄까지만 돌려줘서, 예전처럼 한 번에 select하면 거래처럼 1,000줄이 넘는 표가
// 잘린 채 백업됐음(복원하면 나머지가 사라짐). 표가 없으면 null.
async function readAllRows(supabase: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select("*");
    for (const key of ORDER_KEY[table] ?? ["id"]) query = query.order(key, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (from === 0 && MISSING_TABLE.has(error.code ?? "")) return null;
      throw new Error(`${table} 백업 실패: ${error.message}`);
    }
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data ?? []).length < PAGE_SIZE) return rows;
  }
}

// 백업 파일은 압축(.json.gz, 사용자 결정 10/31) — JSON은 칸 이름이 줄마다 반복돼 압축하면 1/10 안팎으로 줄어듦(저장 공간·
// Supabase 한 파일 한도 50MB·내려받기). 예전 백업(.json, 들여쓰기)도 복원은 그대로 됨 — 읽을 때 압축 여부를 앞 2바이트로 봄.
export function encodeBackupFile(dump: Record<string, unknown>): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(dump), "utf8"));
}

export function decodeBackupFile(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const gzipped = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  return (gzipped ? gunzipSync(buf) : buf).toString("utf8");
}

// 표를 몇 개씩 동시에 읽음 — 자료가 해마다 늘어도 자동 백업이 서버 시간 제한(60초) 안에 끝나게. 결과 순서는 표 순서 그대로.
const READ_CONCURRENCY = 4;

async function readAllTables(supabase: SupabaseClient) {
  const results: (Record<string, unknown>[] | null)[] = new Array(BACKUP_TABLES.length);
  let next = 0;
  async function worker() {
    while (next < BACKUP_TABLES.length) {
      const i = next++;
      results[i] = await readAllRows(supabase, BACKUP_TABLES[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, BACKUP_TABLES.length) }, worker));
  return results;
}

export async function runBackup(supabase: SupabaseClient, backupType: "manual" | "auto") {
  const dump: Record<string, unknown> = {};
  const rowCounts: Record<string, number> = {};
  const tables = await readAllTables(supabase);
  BACKUP_TABLES.forEach((table, i) => {
    const rows = tables[i];
    dump[table] = rows ?? [];
    if (rows) rowCounts[table] = rows.length;
  });
  // 끝까지 담은 새 방식 백업 표시 + 표별 줄 수 — 복원할 때 예전(1,000줄 제한) 백업과 구별하고, 파일이 잘렸는지 확인.
  dump.__meta = { complete: true, created_at: new Date().toISOString(), row_counts: rowCounts };

  const body = encodeBackupFile(dump);
  const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
  const sizeMb = body.length / (1024 * 1024);

  const { error } = await supabase.storage.from("backups").upload(fileName, body, {
    contentType: "application/gzip",
  });
  if (error) throw new Error(`백업 업로드 실패: ${error.message}`);

  // 백업 기록 — 표별 줄 수(row_counts, 095 SQL)도. 칸이 없으면(실행 전) 빼고 기록해서 백업 목록에는 늘 보이게.
  const record = {
    file_name: fileName,
    file_size_mb: Number(sizeMb.toFixed(3)),
    backup_type: backupType,
    storage_url: fileName,
  };
  let { error: recordError } = await supabase.from("backups").insert({ ...record, row_counts: rowCounts });
  if (recordError?.code === "PGRST204") ({ error: recordError } = await supabase.from("backups").insert(record));
  if (recordError) throw new Error(`백업 기록 실패: ${recordError.message}`);

  return { fileName, sizeMb, rowCounts };
}

// 오래된 자동 백업 정리(기준: lib/backupRetention.ts) — 자동 백업이 성공한 뒤에만 부름(백업이 실패하는 동안 지우지 않게).
// 파일을 먼저 지우고, 성공해야 기록을 지움(실패하면 다음 주에 다시 시도).
const PRUNE_CHUNK = 100;

export async function pruneAutoBackups(supabase: SupabaseClient, nowIso: string) {
  const { data, error } = await supabase
    .from("backups")
    .select("id, backup_type, created_at, file_name, storage_url")
    .eq("backup_type", "auto")
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new Error(`백업 목록을 읽지 못했습니다: ${error.message}`);
  const targets = backupsToPrune((data ?? []) as RetentionRecord[], nowIso);
  for (let i = 0; i < targets.length; i += PRUNE_CHUNK) {
    const part = targets.slice(i, i + PRUNE_CHUNK);
    const paths = part.map((t) => t.storage_url || t.file_name).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from("backups").remove(paths);
      if (removeError) throw new Error(`오래된 백업 파일을 지우지 못했습니다: ${removeError.message}`);
    }
    const { error: deleteError } = await supabase
      .from("backups")
      .delete()
      .in(
        "id",
        part.map((t) => t.id)
      );
    if (deleteError) throw new Error(`오래된 백업 기록을 지우지 못했습니다: ${deleteError.message}`);
  }
  return { deleted: targets.length };
}
