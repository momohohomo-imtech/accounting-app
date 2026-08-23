"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TABLES = [
  "clients",
  "sites",
  "projects",
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
];

export async function createManualBackup() {
  const supabase = await createClient();

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

  if (!error) {
    await supabase.from("backups").insert({
      file_name: fileName,
      file_size_mb: Number(sizeMb.toFixed(3)),
      backup_type: "manual",
      storage_url: fileName,
    });
  }

  revalidatePath("/backups");
}
