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
// 인원 구성 변경은 추가만 지원함(기존 인원 제거는 이 화면의 범위 밖) — 인력사무소/직원
// DB에서 고른 인원(new_daily_worker_ids/new_employee_ids)과 DB에 없는 사람을 이름만으로
// 적어 넣는 임의 추가(new_manual_name 등, 같은 인덱스끼리 짝) 둘 다 지원.
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

  const newWorkerIds = formData.getAll("new_daily_worker_ids").map(String);
  const newEmployeeIds = formData.getAll("new_employee_ids").map(String);
  const manualNames = formData.getAll("new_manual_name").map(String);
  const manualPhones = formData.getAll("new_manual_phone").map(String);
  const manualBirthDates = formData.getAll("new_manual_birth_date").map(String);
  const manualNationalities = formData.getAll("new_manual_nationality").map(String);

  const newMembers = [
    ...newWorkerIds.map((daily_worker_id) => ({ access_list_id: id, daily_worker_id, employee_id: null })),
    ...newEmployeeIds.map((employee_id) => ({ access_list_id: id, daily_worker_id: null, employee_id })),
    ...manualNames
      .map((name, i) => ({
        access_list_id: id,
        daily_worker_id: null,
        employee_id: null,
        manual_name: name.trim(),
        manual_phone: manualPhones[i]?.trim() || null,
        manual_birth_date: manualBirthDates[i]?.trim() || null,
        manual_nationality: manualNationalities[i]?.trim() || null,
      }))
      .filter((m) => m.manual_name !== ""),
  ];
  if (newMembers.length > 0) {
    const { error: insertError } = await supabase.from("access_list_workers").insert(newMembers);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/daily-workers");
}

export async function deleteAccessListRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("access_lists").delete().eq("id", id);
  revalidatePath("/daily-workers");
}
