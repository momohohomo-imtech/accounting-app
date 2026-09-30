import type { SupabaseClient } from "@supabase/supabase-js";

const TABLES = [
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
  // 견적서 공급자 목록 — 백업 파일에만 담고 복구(restore.ts)는 건드리지 않음: 설정값이라 복구해도 지금 값을 그대로
  // 두는 게 맞고, SQL 089 실행 전이나 이 표가 없던 예전 백업으로 복구할 때 표를 지우다 복구가 멈추는 일도 없음.
  "company_profiles",
];

export async function runBackup(supabase: SupabaseClient, backupType: "manual" | "auto") {
  const dump: Record<string, unknown> = {};
  for (const table of TABLES) {
    const { data } = await supabase.from(table).select("*");
    dump[table] = data ?? [];
  }

  const json = JSON.stringify(dump, null, 2);
  const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const sizeMb = new Blob([json]).size / (1024 * 1024);

  const { error } = await supabase.storage.from("backups").upload(fileName, json, {
    contentType: "application/json",
  });
  if (error) throw new Error(`백업 업로드 실패: ${error.message}`);

  await supabase.from("backups").insert({
    file_name: fileName,
    file_size_mb: Number(sizeMb.toFixed(3)),
    backup_type: backupType,
    storage_url: fileName,
  });

  return { fileName, json, sizeMb };
}
