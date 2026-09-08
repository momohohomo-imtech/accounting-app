"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createConstructionMemo(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!projectId || !content) return { error: "내용을 입력해주세요." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("construction_memos")
    .insert({ project_id: projectId, content, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function updateConstructionMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!id || !content) return { error: "내용을 입력해주세요." };

  const { error } = await supabase
    .from("construction_memos")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function deleteConstructionMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("construction_memos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}
