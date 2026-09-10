"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 프로젝트 목록 페이지 메모는 항목 구분 없는 단일 텍스트라, 고정 id 행 하나만
// 계속 upsert함(여러 사용자가 같은 메모장을 공유).
const MEMO_ID = "00000000-0000-0000-0000-000000000001";

export async function updateProjectsPageMemo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const content = String(formData.get("content") ?? "");

  const { error } = await supabase
    .from("projects_page_memo")
    .upsert({ id: MEMO_ID, content, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath("/projects");
  return {};
}
