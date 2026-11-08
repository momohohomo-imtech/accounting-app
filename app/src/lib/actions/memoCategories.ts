"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadMemoCategories } from "@/lib/memoCategoryLoad";
import {
  memoCategoryColor,
  memoCategoryNameProblem,
  nextMemoCategorySortOrder,
  normalizeMemoCategoryName,
} from "@/lib/memoCategories";

// 메모장 "구분 관리"(104 SQL, 11/8 사용자 요청) — 추가·이름/색/순서 바꾸기·삭제. 실패는 { error }로(화면에 보여 줌).
// 이름 바꾸기는 DB 함수 rename_memo_category로 구분과 그 구분의 메모를 한 번에(하나라도 실패하면 둘 다 그대로).
// 삭제는 그 구분의 메모가 남아 있으면 막고 몇 개인지 안내(사용자 결정) — 확인 조회가 실패하면 지우지 않음.

const NOT_READY = "Supabase에서 104 SQL(메모장 구분)을 먼저 실행해 주세요.";

function sortOrderOf(formData: FormData): number | null {
  const raw = String(formData.get("sort_order") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "같은 이름의 구분이 이미 있습니다.";
  return error.message;
}

export async function createMemoCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const { categories, ready, error: loadError } = await loadMemoCategories(supabase);
  if (loadError) return { error: `구분 목록을 불러오지 못했습니다: ${loadError}` };
  if (!ready) return { error: NOT_READY };
  const name = normalizeMemoCategoryName(String(formData.get("name") ?? ""));
  const problem = memoCategoryNameProblem(name, categories);
  if (problem) return { error: problem };
  const { error } = await supabase.from("memo_categories").insert({
    name,
    color: memoCategoryColor(String(formData.get("color") ?? "")),
    sort_order: sortOrderOf(formData) ?? nextMemoCategorySortOrder(categories),
  });
  if (error) return { error: friendly(error) };
  revalidatePath("/memos");
}

export async function updateMemoCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { categories, ready, error: loadError } = await loadMemoCategories(supabase);
  if (loadError) return { error: `구분 목록을 불러오지 못했습니다: ${loadError}` };
  if (!ready) return { error: NOT_READY };
  const current = categories.find((c) => c.id === id);
  if (!current) return { error: "구분을 찾지 못했습니다. 새로 고침한 뒤 다시 해 주세요." };
  const name = normalizeMemoCategoryName(String(formData.get("name") ?? ""));
  const problem = memoCategoryNameProblem(name, categories, id);
  if (problem) return { error: problem };

  if (name !== current.name) {
    const { error } = await supabase.rpc("rename_memo_category", { p_id: id, p_name: name });
    if (error) return { error: friendly(error) };
  }
  const { data, error } = await supabase
    .from("memo_categories")
    .update({ color: memoCategoryColor(String(formData.get("color") ?? "")), sort_order: sortOrderOf(formData) ?? current.sort_order })
    .eq("id", id)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "구분을 바꾸지 못했습니다(권한을 확인해 주세요)." };
  revalidatePath("/memos");
}

export async function deleteMemoCategoryRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { data: row, error: findError } = await supabase.from("memo_categories").select("name").eq("id", id).maybeSingle();
  if (findError) return { error: `확인하지 못해 지우지 않았습니다: ${findError.message}` };
  if (!row) return { error: "구분을 찾지 못했습니다. 새로 고침한 뒤 다시 해 주세요." };
  const { count, error: countError } = await supabase
    .from("memos")
    .select("id", { count: "exact", head: true })
    .eq("category", row.name);
  if (countError || count === null) return { error: `확인하지 못해 지우지 않았습니다: ${countError?.message ?? "메모 수를 셀 수 없음"}` };
  if (count > 0) {
    return { error: `'${row.name}' 구분에 메모 ${count}개가 있어 지울 수 없습니다 — 메모를 다른 구분으로 옮긴 뒤 지워주세요.` };
  }
  const { data, error } = await supabase.from("memo_categories").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "구분을 지우지 못했습니다(권한을 확인해 주세요)." };
  revalidatePath("/memos");
}
