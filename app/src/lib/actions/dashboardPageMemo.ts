"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 대시보드 맨 위 메모 — 프로젝트 목록 메모(projectsPageMemo.ts)와 같은 단일 행 upsert 방식.
const MEMO_ID = "00000000-0000-0000-0000-000000000001";

export async function updateDashboardPageMemo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const content = String(formData.get("content") ?? "");

  const { error } = await supabase
    .from("dashboard_page_memo")
    .upsert({ id: MEMO_ID, content, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}
