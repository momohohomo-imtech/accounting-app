"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createDailyWorkerUsageLogRecord(formData: FormData) {
  const supabase = await createClient();
  const useDate = String(formData.get("use_date") ?? "");
  const note = String(formData.get("note") ?? "") || null;
  const workerIds = formData.getAll("daily_worker_ids").map(String).filter(Boolean);
  if (!useDate || workerIds.length === 0) return;

  await supabase
    .from("daily_worker_usage_logs")
    .insert(workerIds.map((daily_worker_id) => ({ use_date: useDate, daily_worker_id, note })));
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
