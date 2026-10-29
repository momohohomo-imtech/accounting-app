import type { SupabaseClient } from "@supabase/supabase-js";

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
];

// 표마다 겹치지 않게 나눠 받을 고유 칸(대부분 id).
const ORDER_KEY: Record<string, string[]> = { trip_logs: ["project_id"], vat_prepayment_notices: ["year", "month"] };
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

export async function runBackup(supabase: SupabaseClient, backupType: "manual" | "auto") {
  const dump: Record<string, unknown> = {};
  const rowCounts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await readAllRows(supabase, table);
    dump[table] = rows ?? [];
    if (rows) rowCounts[table] = rows.length;
  }
  // 끝까지 담은 새 방식 백업 표시 + 표별 줄 수 — 복원할 때 예전(1,000줄 제한) 백업과 구별하고, 파일이 잘렸는지 확인.
  dump.__meta = { complete: true, created_at: new Date().toISOString(), row_counts: rowCounts };

  const json = JSON.stringify(dump, null, 2);
  const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const sizeMb = new Blob([json]).size / (1024 * 1024);

  const { error } = await supabase.storage.from("backups").upload(fileName, json, {
    contentType: "application/json",
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

  return { fileName, json, sizeMb, rowCounts };
}
