"use server";

import { createClient } from "@/lib/supabase/server";

// 작업일지 집계 표의 체크박스 상태 저장 — 체크된 항목만 한 행씩 존재(체크 해제 시
// 그 행을 삭제). 화면 쪽 로컬 상태로 바로 반영되므로 여기서는 굳이 revalidatePath로
// 페이지 전체를 다시 불러오게 하지 않음(다음에 새로 열 때 자연히 최신 상태로 읽힘).
export async function setWorkLogSummaryCheck(year: number, groupKey: string, checked: boolean) {
  const supabase = await createClient();
  if (checked) {
    const { error } = await supabase
      .from("work_log_summary_checks")
      .upsert({ year, group_key: groupKey }, { onConflict: "year,group_key" });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("work_log_summary_checks")
      .delete()
      .eq("year", year)
      .eq("group_key", groupKey);
    if (error) return { error: error.message };
  }
}
