"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runBackup } from "@/lib/backup";

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
