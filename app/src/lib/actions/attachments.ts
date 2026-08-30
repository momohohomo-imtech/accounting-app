"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "project-files";

export async function uploadAttachment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id") ?? "") || null;
  const workDate = String(formData.get("work_date") ?? "") || null;
  const memo = String(formData.get("memo") ?? "") || null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return { error: "파일을 선택해주세요." };
  if (!projectId && !workDate) return { error: "프로젝트 또는 날짜가 필요합니다." };

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storagePath = `${projectId ?? "unassigned"}/${Date.now()}-${crypto.randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("attachments").insert({
    project_id: projectId,
    work_date: workDate,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    file_size: file.size,
    memo,
    created_by: user?.id ?? null,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath("/projects");
  revalidatePath("/worklogs");
}

export async function deleteAttachment(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 항목입니다." };

  const { data: row, error: fetchError } = await supabase.from("attachments").select("storage_path").eq("id", id).single();
  if (fetchError || !row) return { error: fetchError?.message ?? "파일을 찾을 수 없습니다." };

  await supabase.storage.from(BUCKET).remove([row.storage_path]);
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/projects");
  revalidatePath("/worklogs");
}
