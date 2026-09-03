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
  const helperCountRaw = String(formData.get("helper_count") ?? "").trim();
  const helperCount = helperCountRaw ? Number(helperCountRaw) : null;
  const toolIds = formData.getAll("tool_id").map(String);
  const toolNames = formData.getAll("tool_name").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const forAccessPass = formData.getAll("for_access_pass").map((v) => v === "true");
  if (!title) return { error: "제목을 입력해주세요." };
  if (toolIds.length === 0) return { error: "품목을 1개 이상 입력해주세요." };

  const { data: checklist, error } = await supabase
    .from("tool_checklists")
    .insert({ title, project_id: projectId, trip_date: tripDate, helper_count: helperCount, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !checklist) return { error: error?.message ?? "저장 중 오류가 발생했습니다." };

  const items = toolIds.map((id, i) => ({
    checklist_id: checklist.id,
    tool_id: id || null,
    tool_name: toolNames[i] ?? "",
    quantity: quantities[i] || "1",
    checked: true,
    for_access_pass: forAccessPass[i] ?? false,
  }));
  const { error: itemsError } = await supabase.from("tool_checklist_items").insert(items);
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/quality-construction");
  return { id: checklist.id as string };
}

// 기존 체크리스트의 제목/프로젝트/출장일/품목을 수정 — 작업일지 날짜별 저장과 동일하게
// 품목은 항상 "전부 지우고 다시 insert" 방식(부분 수정보다 단순하고, 그룹 묶기/순서
// 문제도 없음).
export async function updateToolChecklist(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };
  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "") || null;
  const tripDate = String(formData.get("trip_date") ?? "") || null;
  const helperCountRaw = String(formData.get("helper_count") ?? "").trim();
  const helperCount = helperCountRaw ? Number(helperCountRaw) : null;
  const toolIds = formData.getAll("tool_id").map(String);
  const toolNames = formData.getAll("tool_name").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const forAccessPass = formData.getAll("for_access_pass").map((v) => v === "true");
  if (!title) return { error: "제목을 입력해주세요." };
  if (toolIds.length === 0) return { error: "품목을 1개 이상 입력해주세요." };

  const { error: updateError } = await supabase
    .from("tool_checklists")
    .update({ title, project_id: projectId, trip_date: tripDate, helper_count: helperCount })
    .eq("id", id);
  if (updateError) return { error: updateError.message };

  const { error: deleteError } = await supabase.from("tool_checklist_items").delete().eq("checklist_id", id);
  if (deleteError) return { error: deleteError.message };

  const items = toolIds.map((toolId, i) => ({
    checklist_id: id,
    tool_id: toolId || null,
    tool_name: toolNames[i] ?? "",
    quantity: quantities[i] || "1",
    checked: true,
    for_access_pass: forAccessPass[i] ?? false,
  }));
  const { error: itemsError } = await supabase.from("tool_checklist_items").insert(items);
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/quality-construction");
  return { id };
}

export async function deleteToolChecklist(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("tool_checklists").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}
