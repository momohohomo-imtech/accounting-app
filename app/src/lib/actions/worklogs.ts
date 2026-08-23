"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  return {
    log_date: String(formData.get("log_date")),
    project_id: String(formData.get("project_id")),
    title: String(formData.get("title") ?? ""),
    workers: String(formData.get("workers") ?? "") || null,
    start_time: String(formData.get("start_time") ?? "") || null,
    end_time: String(formData.get("end_time") ?? "") || null,
    content: String(formData.get("content") ?? "") || null,
  };
}

export async function createWorkLogRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("work_logs").insert(parse(formData));
  revalidatePath("/worklogs");
}

export async function updateWorkLogRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("work_logs").update(parse(formData)).eq("id", id);
  revalidatePath("/worklogs");
}

export async function deleteWorkLogRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("work_logs").delete().eq("id", id);
  revalidatePath("/worklogs");
}
