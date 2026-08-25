"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runBackup } from "@/lib/backup";
import { restoreFromBackup } from "@/lib/restore";

export async function createManualBackup(): Promise<{ error?: string; fileName?: string }> {
  const supabase = await createClient();
  try {
    const { fileName } = await runBackup(supabase, "manual");
    revalidatePath("/backups");
    return { fileName };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "백업 생성에 실패했습니다." };
  }
}

export async function deleteBackupRecord(formData: FormData): Promise<{ error?: string }> {
  const id = String(formData.get("id") ?? "");
  const fileName = String(formData.get("fileName") ?? "");
  if (!id || !fileName) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  await supabase.storage.from("backups").remove([fileName]);
  const { error } = await supabase.from("backups").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/backups");
  return {};
}

export async function restoreBackup(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const fileName = String(formData.get("fileName") ?? "");
  const confirmText = String(formData.get("confirmText") ?? "");
  if (confirmText !== "복구") {
    return { error: "확인 문구가 일치하지 않습니다." };
  }
  if (!fileName) return { error: "파일을 찾을 수 없습니다." };

  const supabase = await createClient();
  try {
    const { data, error: downloadError } = await supabase.storage.from("backups").download(fileName);
    if (downloadError || !data) throw new Error(downloadError?.message ?? "백업 파일을 불러올 수 없습니다.");
    const dump = JSON.parse(await data.text());
    await restoreFromBackup(supabase, dump);
    revalidatePath("/backups");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "복구에 실패했습니다." };
  }
}
