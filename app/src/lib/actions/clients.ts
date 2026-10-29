"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteBlockReason, deleteErrorMessage, CLIENT_LINKS } from "@/lib/deleteGuard";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "both"),
    phone: String(formData.get("phone") ?? "") || null,
    biz_reg_no: String(formData.get("biz_reg_no") ?? "") || null,
    representative_name: String(formData.get("representative_name") ?? "") || null,
    biz_address: String(formData.get("biz_address") ?? "") || null,
    biz_type: String(formData.get("biz_type") ?? "") || null,
    biz_item: String(formData.get("biz_item") ?? "") || null,
    tax_email: String(formData.get("tax_email") ?? "") || null,
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
  const blocked = await deleteBlockReason(
    supabase,
    CLIENT_LINKS,
    id,
    "이 거래처에",
    "다른 거래처로 바꾼 뒤 삭제해주세요(그대로 지우면 거래의 거래처 칸이 빈칸이 됨)."
  );
  if (blocked) return { error: blocked };
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: deleteErrorMessage(error) };
  revalidatePath("/transactions");
}
