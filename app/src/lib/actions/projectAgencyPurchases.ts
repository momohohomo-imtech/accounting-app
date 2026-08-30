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
  const amount = Number(formData.get("amount") ?? 0);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  if (!projectId || !amount) return { error: "품목명과 금액을 확인해주세요." };

  const { error } = await supabase.from("project_agency_purchases").insert({
    project_id: projectId,
    item_name: itemName,
    amount,
    category_id: categoryId,
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
  const amount = Number(formData.get("amount") ?? 0);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  if (!id || !amount) return { error: "품목명과 금액을 확인해주세요." };

  const { error } = await supabase
    .from("project_agency_purchases")
    .update({ item_name: itemName, amount, category_id: categoryId })
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
