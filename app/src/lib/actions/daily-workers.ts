"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteBlockReason, deleteErrorMessage, DAILY_WORKER_LINKS } from "@/lib/deleteGuard";

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
    resident_id: String(formData.get("resident_id") ?? "") || null,
    language_ability: String(formData.get("language_ability") ?? "") || null,
    other_ability: String(formData.get("other_ability") ?? "") || null,
    bank_name: String(formData.get("bank_name") ?? "") || null,
    account_number: String(formData.get("account_number") ?? "") || null,
  };
}

export async function createDailyWorkerRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("daily_workers").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/daily-workers");
}

export async function updateDailyWorkerRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("daily_workers").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/daily-workers");
}

export async function deleteDailyWorkerRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const blocked = await deleteBlockReason(
    supabase,
    DAILY_WORKER_LINKS,
    id,
    "이 일용직에게",
    "그만둔 일용직은 지우지 말고 상태를 \"종료\"로 바꿔 두세요(지우면 사용내역이 같이 지워짐)."
  );
  if (blocked) return { error: blocked };
  const { error } = await supabase.from("daily_workers").delete().eq("id", id);
  if (error) return { error: deleteErrorMessage(error) };
  revalidatePath("/daily-workers");
}
