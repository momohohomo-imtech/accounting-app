"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
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
