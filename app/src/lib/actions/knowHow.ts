"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
  };
}

export async function createKnowHowNote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const category = String(formData.get("category") ?? "");
  const values = parse(formData);
  if (!category || !values.title) return { error: "제목을 입력해주세요." };

  const { error } = await supabase
    .from("know_how_notes")
    .insert({ ...values, category, created_by: user?.id ?? null });
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function updateKnowHowNote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const values = parse(formData);
  if (!id || !values.title) return { error: "제목을 입력해주세요." };

  const { error } = await supabase.from("know_how_notes").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}

export async function deleteKnowHowNote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { error } = await supabase.from("know_how_notes").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/quality-construction");
}
