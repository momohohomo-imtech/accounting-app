"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createToolChecklist(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "") || null;
  const tripDate = String(formData.get("trip_date") ?? "") || null;
  const toolIds = formData.getAll("tool_id").map(String);
  const toolNames = formData.getAll("tool_name").map(String);
  if (!title) return { error: "제목을 입력해주세요." };
  if (toolIds.length === 0) return { error: "공구를 1개 이상 선택해주세요." };

  const { data: checklist, error } = await supabase
    .from("tool_checklists")
    .insert({ title, project_id: projectId, trip_date: tripDate, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !checklist) return { error: error?.message ?? "저장 중 오류가 발생했습니다." };

  const items = toolIds.map((id, i) => ({
    checklist_id: checklist.id,
    tool_id: id || null,
    tool_name: toolNames[i] ?? "",
    checked: true,
  }));
  const { error: itemsError } = await supabase.from("tool_checklist_items").insert(items);
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/quality-construction");
  return { id: checklist.id as string };
}

export async function deleteToolChecklist(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("tool_checklists").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}
