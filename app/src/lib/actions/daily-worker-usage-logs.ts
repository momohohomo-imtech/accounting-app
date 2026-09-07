"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createDailyWorkerUsageLogRecord(formData: FormData) {
  const supabase = await createClient();
  const useDates = formData.getAll("use_dates").map(String).filter(Boolean);
  const note = String(formData.get("note") ?? "") || null;
  const dailyWageRaw = String(formData.get("daily_wage") ?? "");
  const daily_wage = dailyWageRaw ? Number(dailyWageRaw) : null;
  const site_id = String(formData.get("site_id") ?? "") || null;
  const workerIds = formData.getAll("daily_worker_ids").map(String).filter(Boolean);
  if (useDates.length === 0 || workerIds.length === 0) return;

  const rows = useDates.flatMap((use_date) =>
    workerIds.map((daily_worker_id) => ({ use_date, daily_worker_id, note, daily_wage, site_id }))
  );
  await supabase.from("daily_worker_usage_logs").insert(rows);
  revalidatePath("/daily-workers");
}

export async function updateDailyWorkerUsageLogRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase
    .from("daily_worker_usage_logs")
    .update({
      use_date: String(formData.get("use_date") ?? ""),
      daily_worker_id: String(formData.get("daily_worker_id") ?? ""),
      note: String(formData.get("note") ?? "") || null,
      daily_wage: formData.get("daily_wage") ? Number(formData.get("daily_wage")) : null,
      site_id: String(formData.get("site_id") ?? "") || null,
    })
    .eq("id", id);
  revalidatePath("/daily-workers");
}

export async function deleteDailyWorkerUsageLogRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("daily_worker_usage_logs").delete().eq("id", id);
  revalidatePath("/daily-workers");
}
