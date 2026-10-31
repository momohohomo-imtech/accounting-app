"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { attachmentStoragePath, isAttachmentStoragePath, isUuid } from "@/lib/fileUpload";

const BUCKET = "project-files";

// 첨부파일은 서버를 거치지 않고 브라우저에서 저장소로 바로 올림 — 서버(Vercel)는 4.5MB 넘는 요청을 거절해서 휴대폰
// 사진·도면 PDF가 서버 액션으로는 안 올라갔음(lib/fileUpload.ts 맨 위). 순서: ① prepareAttachmentUpload가 이 사용자 권한으로
// 서명된 올리기 주소(2시간)를 만들고 → ② 브라우저가 그 주소로 파일을 올리고(AttachmentList) → ③ saveUploadedAttachment가
// 표에 기록(실패하면 올린 파일을 지움). 저장소 권한(040·084 SQL)은 그대로 — 관리자·직원만 주소를 만들 수 있음.

type AttachmentTarget = { projectId: string | null; workDate: string | null };

function targetError({ projectId, workDate }: AttachmentTarget) {
  if (!projectId && !workDate) return "프로젝트 또는 날짜가 필요합니다.";
  if (projectId && !isUuid(projectId)) return "잘못된 프로젝트입니다.";
  if (workDate && !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return "잘못된 날짜입니다.";
  return null;
}

export async function prepareAttachmentUpload(
  input: AttachmentTarget & { fileName: string }
): Promise<{ path: string; token: string; error?: undefined } | { error: string }> {
  const target = { projectId: input.projectId || null, workDate: input.workDate || null };
  const invalid = targetError(target);
  if (invalid) return { error: invalid };
  if (!input.fileName) return { error: "파일을 선택해주세요." };

  const supabase = await createClient();
  const path = attachmentStoragePath(target.projectId, input.fileName, Date.now(), crypto.randomUUID());
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: `파일을 올릴 준비를 하지 못했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  return { path: data.path, token: data.token };
}

export async function saveUploadedAttachment(
  input: AttachmentTarget & { path: string; fileName: string; mimeType: string | null; size: number; memo: string | null }
) {
  const target = { projectId: input.projectId || null, workDate: input.workDate || null };
  const invalid = targetError(target);
  if (invalid) return { error: invalid };
  // 이 앱이 만든 모양의 경로이고 그 프로젝트 폴더인지 — 다른 파일을 가리키는 기록을 만들지 못하게.
  if (!isAttachmentStoragePath(input.path, target.projectId)) return { error: "잘못된 파일 경로입니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 크기·형식은 저장소에 실제로 올라간 값으로(확인이 안 되면 브라우저가 알려 준 값).
  const { data: info } = await supabase.storage.from(BUCKET).info(input.path);
  const size = typeof info?.size === "number" ? info.size : Number.isFinite(input.size) ? input.size : null;

  const { error: insertError } = await supabase.from("attachments").insert({
    project_id: target.projectId,
    work_date: target.workDate,
    file_name: input.fileName,
    storage_path: input.path,
    mime_type: input.mimeType || info?.contentType || null,
    file_size: size,
    memo: input.memo || null,
    created_by: user?.id ?? null,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([input.path]);
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
