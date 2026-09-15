"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
  };
}

export async function createMemoRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 새 메모는 항상 맨 위에 오도록 현재 최소 정렬순서보다 더 작은 값을 준다.
  const { data: minRow } = await supabase.from("memos").select("sort_order").order("sort_order").limit(1).maybeSingle();
  const sort_order = (minRow?.sort_order ?? 1) - 1;
  await supabase.from("memos").insert({ ...parse(formData), created_by: user?.id ?? null, sort_order });
  revalidatePath("/memos");
}

export async function updateMemoRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase
    .from("memos")
    .update({ ...parse(formData), updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/memos");
}

export async function deleteMemoRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("memos").delete().eq("id", id);
  revalidatePath("/memos");
}

// 메모 카드를 한 칸 위/아래로 — 화면에 보이는 순서(sort_order → created_at desc)상
// 바로 이웃한 메모와 정렬순서 값을 맞바꾼다.
export async function moveMemoRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const direction = String(formData.get("direction"));

  const { data: memos } = await supabase
    .from("memos")
    .select("id, sort_order")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (!memos) return;

  const idx = memos.findIndex((m) => m.id === id);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= memos.length) return;

  const current = memos[idx];
  const neighbor = memos[swapIdx];
  await supabase.from("memos").update({ sort_order: neighbor.sort_order }).eq("id", current.id);
  await supabase.from("memos").update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  revalidatePath("/memos");
}
