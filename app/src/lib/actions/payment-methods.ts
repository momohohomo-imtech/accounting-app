"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    sort_order: formData.get("sort_order") ? Number(formData.get("sort_order")) : 0,
  };
}

export async function createPaymentMethodRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("payment_methods").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}

export async function updatePaymentMethodRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("payment_methods").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}

export async function deletePaymentMethodRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}

export async function updatePaymentMethodColor(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const textColor = String(formData.get("text_color") ?? "") || null;
  const backgroundColor = String(formData.get("background_color") ?? "") || null;
  await supabase.from("payment_methods").update({ text_color: textColor, background_color: backgroundColor }).eq("id", id);
  revalidatePath("/transactions");
}
