"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    office_id: String(formData.get("office_id")),
    name: String(formData.get("name") ?? ""),
    birth_date: String(formData.get("birth_date") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    nationality: String(formData.get("nationality") ?? "") || null,
    current_location: String(formData.get("current_location") ?? "") || null,
    status: String(formData.get("status") ?? "active"),
    memo: String(formData.get("memo") ?? "") || null,
  };
}

export async function createDailyWorkerRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("daily_workers").insert(parse(formData));
  revalidatePath("/daily-workers");
}

export async function updateDailyWorkerRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("daily_workers").update(parse(formData)).eq("id", id);
  revalidatePath("/daily-workers");
}

export async function deleteDailyWorkerRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("daily_workers").delete().eq("id", id);
  revalidatePath("/daily-workers");
}
