"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    site_id: String(formData.get("site_id")),
    parent_project_id: String(formData.get("parent_project_id") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    status: String(formData.get("status") ?? "ongoing"),
    is_service: formData.get("is_service") === "on",
    start_date: String(formData.get("start_date") ?? "") || null,
    end_date: String(formData.get("end_date") ?? "") || null,
    progress_pct: formData.get("progress_pct") ? Number(formData.get("progress_pct")) : 0,
    year: Number(formData.get("year") ?? new Date().getFullYear()),
  };
}

export async function createProjectRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("projects").insert(parse(formData));
  revalidatePath("/projects");
}

export async function updateProjectRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("projects").update(parse(formData)).eq("id", id);
  revalidatePath("/projects");
}

export async function deleteProjectRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/projects");
}
