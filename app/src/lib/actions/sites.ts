"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    location: String(formData.get("location") ?? "") || null,
    manager_name: String(formData.get("manager_name") ?? "") || null,
    client_id: String(formData.get("client_id") ?? "") || null,
  };
}

export async function createSiteRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function updateSiteRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("sites").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function deleteSiteRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

// 작업일지 하단의 현장 색상 범례에서 개별 현장 고유색만 수정/초기화할 때 쓰는 전용 액션.
export async function updateSiteColor(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const color = String(formData.get("color") ?? "") || null;
  const { error } = await supabase.from("sites").update({ color }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/worklogs");
  revalidatePath("/reports");
}
