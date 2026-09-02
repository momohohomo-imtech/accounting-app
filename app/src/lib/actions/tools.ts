"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    sort_order: sortOrderRaw === "" ? 0 : Number(sortOrderRaw) || 0,
    note: String(formData.get("note") ?? "") || null,
  };
}

export async function createTool(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = parse(formData);
  if (!values.name) return { error: "공구명을 입력해주세요." };

  const { error } = await supabase.from("tools").insert({ ...values, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function updateTool(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const values = parse(formData);
  if (!id || !values.name) return { error: "공구명을 입력해주세요." };

  const { error } = await supabase.from("tools").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function deleteTool(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

// 같은 순번 그룹 안에서 위/아래로 옮기기 — 그룹의 전체 순서를 그대로 받아서
// position을 0부터 다시 매겨버리는 방식이라, 이전 position 값이 뭐였든 항상
// 정확히 그 순서대로 다시 정렬됨(스왑 방식과 달리 두 항목의 position이 우연히
// 같아도 안전함).
export async function reorderTools(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("id").map(String);
  if (ids.length === 0) return { error: "잘못된 요청입니다." };

  await Promise.all(ids.map((id, i) => supabase.from("tools").update({ position: i }).eq("id", id)));
  revalidatePath("/quality-construction");
}
