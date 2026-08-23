"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    location: String(formData.get("location") ?? "") || null,
    manager_name: String(formData.get("manager_name") ?? "") || null,
  };
}

export async function createSiteRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("sites").insert(parse(formData));
  revalidatePath("/projects");
}

export async function updateSiteRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("sites").update(parse(formData)).eq("id", id);
  revalidatePath("/projects");
}

export async function deleteSiteRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("sites").delete().eq("id", id);
  revalidatePath("/projects");
}
