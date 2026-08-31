"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    process_name: String(formData.get("process_name") ?? "").trim(),
    item_name: String(formData.get("item_name") ?? "").trim(),
    result: String(formData.get("result") ?? "보류"),
    check_date: String(formData.get("check_date") ?? "") || null,
    note: String(formData.get("note") ?? "") || null,
  };
}

export async function createQualityChecklistItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const projectId = String(formData.get("project_id") ?? "");
  const values = parse(formData);
  if (!projectId || !values.process_name || !values.item_name) {
    return { error: "공정/공사명과 점검 항목을 입력해주세요." };
  }

  const { error } = await supabase
    .from("quality_checklist_items")
    .insert({ ...values, project_id: projectId, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function updateQualityChecklistItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const values = parse(formData);
  if (!id || !values.process_name || !values.item_name) {
    return { error: "공정/공사명과 점검 항목을 입력해주세요." };
  }

  const { error } = await supabase.from("quality_checklist_items").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function deleteQualityChecklistItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("quality_checklist_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}
