"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    sort_order: sortOrderRaw === "" ? 0 : Number(sortOrderRaw) || 0,
    note: String(formData.get("note") ?? "") || null,
    linked_tool_ids: formData.getAll("linked_tool_id").map(String).filter(Boolean),
    text_color: String(formData.get("text_color") ?? "").trim() || null,
    background_color: String(formData.get("background_color") ?? "").trim() || null,
    default_quantity: String(formData.get("default_quantity") ?? "").trim() || null,
  };
}

export async function createTool(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const values = parse(formData);
  if (!values.name) return { error: "공구명을 입력해주세요." };

  // 같은 순번 그룹의 맨 뒤에 붙임 — position을 항상 0으로 두면 그 순번에 이미 있던
  // 항목과 값이 겹쳐서(동점) 위/아래로 옮겨도 순서가 안 바뀌는 것처럼 보일 수 있음.
  const { data: lastRow } = await supabase
    .from("tools")
    .select("position")
    .eq("sort_order", values.sort_order)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (lastRow?.position ?? -1) + 1;

  const { error } = await supabase.from("tools").insert({ ...values, position, created_by: user?.id ?? null });
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

// 같은 순번 그룹 안에서 바로 옆 항목과 위/아래로 자리 바꾸기 — 그룹 전체의 position을
// 다시 매기던 이전 방식은 그룹 크기(N)만큼 UPDATE가 나가서(예: 소공구 27개면 클릭 한 번에
// 27번 요청) 화면이 느려지는 원인이었음. 실제로 옮길 두 항목의 position 값만 서로
// 바꾸면 되므로 항상 딱 2번의 UPDATE로 끝남.
export async function swapToolPosition(formData: FormData) {
  const supabase = await createClient();
  const idA = String(formData.get("id_a") ?? "");
  const idB = String(formData.get("id_b") ?? "");
  if (!idA || !idB) return { error: "잘못된 요청입니다." };

  const { data: rows, error } = await supabase.from("tools").select("id, position").in("id", [idA, idB]);
  if (error) return { error: error.message };
  const posA = rows?.find((r) => r.id === idA)?.position ?? 0;
  const posB = rows?.find((r) => r.id === idB)?.position ?? 0;

  await Promise.all([
    supabase.from("tools").update({ position: posB }).eq("id", idA),
    supabase.from("tools").update({ position: posA }).eq("id", idB),
  ]);
  revalidatePath("/quality-construction");
}
