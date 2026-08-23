"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAccessListRecord(formData: FormData) {
  const supabase = await createClient();
  const workerIds = formData.getAll("daily_worker_ids").map(String);

  const { data, error } = await supabase
    .from("access_lists")
    .insert({
      company_name: String(formData.get("company_name") ?? ""),
      site_id: String(formData.get("site_id") ?? "") || null,
      supervisor_name: String(formData.get("supervisor_name") ?? "") || null,
      access_period: String(formData.get("access_period") ?? "") || null,
    })
    .select("id")
    .single();

  if (!error && data && workerIds.length > 0) {
    await supabase
      .from("access_list_workers")
      .insert(workerIds.map((daily_worker_id) => ({ access_list_id: data.id, daily_worker_id })));
  }

  revalidatePath("/daily-workers");
}

export async function deleteAccessListRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("access_lists").delete().eq("id", id);
  revalidatePath("/daily-workers");
}
