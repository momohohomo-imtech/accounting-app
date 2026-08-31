"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    stage_name: String(formData.get("stage_name") ?? "").trim(),
    status: String(formData.get("status") ?? "대기"),
    planned_date: String(formData.get("planned_date") ?? "") || null,
    completed_date: String(formData.get("completed_date") ?? "") || null,
    note: String(formData.get("note") ?? "") || null,
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
  };
}

export async function createConstructionStage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const projectId = String(formData.get("project_id") ?? "");
  const values = parse(formData);
  if (!projectId || !values.stage_name) return { error: "단계명을 입력해주세요." };

  const { error } = await supabase
    .from("construction_stages")
    .insert({ ...values, project_id: projectId, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function updateConstructionStage(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const values = parse(formData);
  if (!id || !values.stage_name) return { error: "단계명을 입력해주세요." };

  const { error } = await supabase.from("construction_stages").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function deleteConstructionStage(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("construction_stages").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}
