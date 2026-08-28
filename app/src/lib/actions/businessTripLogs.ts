"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseJsonField(formData: FormData, key: string) {
  try {
    const parsed = JSON.parse(String(formData.get(key) ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parse(formData: FormData) {
  return {
    work_date: String(formData.get("work_date") ?? ""),
    created_date: String(formData.get("created_date") ?? ""),
    client_name: String(formData.get("client_name") ?? "") || null,
    site_name: String(formData.get("site_name") ?? "") || null,
    project_name: String(formData.get("project_name") ?? "") || null,
    work_types: formData.getAll("work_types").map(String),
    note: String(formData.get("note") ?? "") || null,
    workers: parseJsonField(formData, "workers_json"),
    total_manpower: String(formData.get("total_manpower") ?? "") || null,
    equipment: parseJsonField(formData, "equipment_json"),
    expenses: parseJsonField(formData, "expenses_json"),
  };
}

export async function createBusinessTripLog(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("business_trip_logs").insert({ ...parse(formData), created_by: user?.id ?? null });
  revalidatePath("/worklogs");
}

export async function updateBusinessTripLog(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase
    .from("business_trip_logs")
    .update({ ...parse(formData), updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/worklogs");
}

export async function deleteBusinessTripLog(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("business_trip_logs").delete().eq("id", id);
  revalidatePath("/worklogs");
}
