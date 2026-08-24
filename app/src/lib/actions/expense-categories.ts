"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    sort_order: formData.get("sort_order") ? Number(formData.get("sort_order")) : 0,
  };
}

export async function createExpenseCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("expense_categories").insert(parse(formData));
  revalidatePath("/transactions");
}

export async function updateExpenseCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("expense_categories").update(parse(formData)).eq("id", id);
  revalidatePath("/transactions");
}

export async function deleteExpenseCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("expense_categories").delete().eq("id", id);
  revalidatePath("/transactions");
}
