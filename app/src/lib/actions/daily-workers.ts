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
    grade: String(formData.get("grade") ?? "") || null,
    resident_id_masked: String(formData.get("resident_id_masked") ?? "") || null,
    language_ability: String(formData.get("language_ability") ?? "") || null,
    other_ability: String(formData.get("other_ability") ?? "") || null,
    bank_name: String(formData.get("bank_name") ?? "") || null,
    account_number: String(formData.get("account_number") ?? "") || null,
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
