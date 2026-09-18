"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAgencyPurchase(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id") ?? "");
  const itemName = String(formData.get("item_name") ?? "") || null;
  const amountRaw = formData.get("amount");
  const amount = Number(amountRaw ?? "");
  // 0원 품목도 유효한 값이라, falsy 체크(!amount) 대신 값이 아예 없거나 숫자가 아닌 경우만 막는다.
  if (!projectId || amountRaw === null || amountRaw === "" || Number.isNaN(amount)) {
    return { error: "품목명과 금액을 확인해주세요." };
  }
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const memo = String(formData.get("memo") ?? "") || null;
  const clientName = String(formData.get("client_name") ?? "") || null;

  const { error } = await supabase.from("project_agency_purchases").insert({
    project_id: projectId,
    item_name: itemName,
    amount,
    category_id: categoryId,
    memo,
    client_name: clientName,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath("/reports");
}

export async function updateAgencyPurchase(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const itemName = String(formData.get("item_name") ?? "") || null;
  const amountRaw = formData.get("amount");
  const amount = Number(amountRaw ?? "");
  if (!id || amountRaw === null || amountRaw === "" || Number.isNaN(amount)) {
    return { error: "품목명과 금액을 확인해주세요." };
  }
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const memo = String(formData.get("memo") ?? "") || null;
  const clientName = String(formData.get("client_name") ?? "") || null;

  const { error } = await supabase
    .from("project_agency_purchases")
    .update({ item_name: itemName, amount, category_id: categoryId, memo, client_name: clientName })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath("/reports");
}

export async function deleteAgencyPurchase(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("project_agency_purchases").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath("/reports");
}
