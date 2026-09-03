"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAccessListRecord(formData: FormData) {
  const supabase = await createClient();
  const workerIds = formData.getAll("daily_worker_ids").map(String);
  const employeeIds = formData.getAll("employee_ids").map(String);

  const { data, error } = await supabase
    .from("access_lists")
    .insert({
      company_name: String(formData.get("company_name") ?? ""),
      site_id: String(formData.get("site_id") ?? "") || null,
      supervisor_name: String(formData.get("supervisor_name") ?? "") || null,
      access_period: String(formData.get("access_period") ?? "") || null,
    })
    .select("id")
    .single();

  if (!error && data) {
    const members = [
      ...workerIds.map((daily_worker_id) => ({ access_list_id: data.id, daily_worker_id, employee_id: null })),
      ...employeeIds.map((employee_id) => ({ access_list_id: data.id, daily_worker_id: null, employee_id })),
    ];
    if (members.length > 0) {
      await supabase.from("access_list_workers").insert(members);
    }
  }

  revalidatePath("/daily-workers");
}

// 출입명단 헤더(업체명/현장/감독자/출입기간)와 각 인원의 비고를 한 번에 저장.
// 명단에 속한 인원 구성(누가 있는지)은 여기서 바꾸지 않음 — 그건 새 명단을 만드는 쪽 영역.
export async function updateAccessListRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const { error } = await supabase
    .from("access_lists")
    .update({
      company_name: String(formData.get("company_name") ?? ""),
      site_id: String(formData.get("site_id") ?? "") || null,
      supervisor_name: String(formData.get("supervisor_name") ?? "") || null,
      access_period: String(formData.get("access_period") ?? "") || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const workerIds = formData.getAll("worker_id").map(String);
  const notes = formData.getAll("worker_note").map(String);
  const results = await Promise.all(
    workerIds.map((workerId, i) => supabase.from("access_list_workers").update({ note: notes[i] || null }).eq("id", workerId))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/daily-workers");
}

export async function deleteAccessListRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("access_lists").delete().eq("id", id);
  revalidatePath("/daily-workers");
}
