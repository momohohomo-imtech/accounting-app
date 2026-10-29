"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteBlockReason, deleteErrorMessage, PAYMENT_METHOD_LINKS } from "@/lib/deleteGuard";

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
  const blocked = await deleteBlockReason(supabase, PAYMENT_METHOD_LINKS, id, "이 결제수단에", "다른 결제수단으로 바꾼 뒤 삭제해주세요.");
  if (blocked) return { error: blocked };
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) return { error: deleteErrorMessage(error) };
  revalidatePath("/transactions");
}

export async function updatePaymentMethodColor(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const textColor = String(formData.get("text_color") ?? "") || null;
  const backgroundColor = String(formData.get("background_color") ?? "") || null;
  const { error } = await supabase
    .from("payment_methods")
    .update({ text_color: textColor, background_color: backgroundColor })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
}
