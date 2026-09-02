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
  const projects = parseJsonField(formData, "projects_json") as { work_date?: string }[];
  // 목록 정렬/기본 표시용 대표 날짜 — 프로젝트별 공사일 중 가장 이른 날짜.
  const dates = projects.map((p) => p.work_date).filter((d): d is string => Boolean(d)).sort();
  const workDate = dates[0] ?? new Date().toISOString().slice(0, 10);

  const dayCountRaw = String(formData.get("day_count") ?? "").trim();
  const dayCount = dayCountRaw === "" ? null : Number(dayCountRaw);

  return {
    work_date: workDate,
    created_date: String(formData.get("created_date") ?? ""),
    client_name: String(formData.get("client_name") ?? "") || null,
    site_name: String(formData.get("site_name") ?? "") || null,
    work_types: formData.getAll("work_types").map(String),
    note: String(formData.get("note") ?? "") || null,
    day_count: dayCount !== null && Number.isFinite(dayCount) ? dayCount : null,
    projects,
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
