"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    manager_name: String(formData.get("manager_name") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
  };
}

export async function createOfficeRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("daily_worker_offices").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/daily-workers");
}

export async function updateOfficeRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("daily_worker_offices").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/daily-workers");
}

export async function deleteOfficeRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("daily_worker_offices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/daily-workers");
}
