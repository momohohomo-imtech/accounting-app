"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "both"),
    phone: String(formData.get("phone") ?? "") || null,
    default_item_name: String(formData.get("default_item_name") ?? "") || null,
    default_category_id: String(formData.get("default_category_id") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
  };
}

export async function createClientRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}

export async function updateClientRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("clients").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}

export async function deleteClientRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}
