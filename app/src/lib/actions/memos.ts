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
  await supabase.from("memos").insert({ ...parse(formData), created_by: user?.id ?? null });
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
