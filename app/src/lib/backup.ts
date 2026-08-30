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
  "report_ai_insights",
  "project_agency_purchases",
  // 파일 자체(storage 버킷 내용)는 백업 안 됨 — 이 목록은 메타데이터(파일명/경로)만 담음.
  "attachments",
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
