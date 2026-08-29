"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    sort_order: formData.get("sort_order") ? Number(formData.get("sort_order")) : 0,
    project_only: formData.get("project_only") === "on",
  };
}

function revalidateAll() {
  revalidatePath("/transactions");
  revalidatePath("/projects");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function createExpenseCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("expense_categories").insert(parse(formData));
  revalidateAll();
}

export async function updateExpenseCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("expense_categories").update(parse(formData)).eq("id", id);
  revalidateAll();
}

export async function deleteExpenseCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("expense_categories").delete().eq("id", id);
  revalidateAll();
}

// 지출카테고리 색상 범례에서 개별 카테고리 색만 수정/초기화할 때 쓰는 전용 액션 (sites.color와 동일 패턴).
export async function updateExpenseCategoryColor(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const color = String(formData.get("color") ?? "") || null;
  await supabase.from("expense_categories").update({ color }).eq("id", id);
  revalidateAll();
}
