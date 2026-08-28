"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveDayWorkLogs(formData: FormData) {
  const supabase = await createClient();
  const logDate = String(formData.get("log_date"));

  await supabase.from("work_logs").delete().eq("log_date", logDate);

  const rows = [];
  for (let i = 0; i < 5; i++) {
    const title = String(formData.get(`title_${i}`) ?? "").trim();
    const siteId = String(formData.get(`site_id_${i}`) ?? "") || null;
    // 현장만 선택하고 내용은 비워둔 줄도 저장 — 같은 현장 작업이 이어지는 날을
    // 매번 내용 재입력 없이 색으로만 표시할 수 있게.
    if (!title && !siteId) continue;
    rows.push({ log_date: logDate, title, site_id: siteId, sort_order: i });
  }
  if (rows.length) await supabase.from("work_logs").insert(rows);

  const [year, month] = logDate.split("-");
  redirect(`/worklogs?year=${Number(year)}&month=${Number(month)}`);
}

export type WorkLogDetailEntry = { id: string; log_date: string; content: string | null };

/**
 * 작업 집계 표에서 특정 (현장, 내용) 묶음을 클릭했을 때 그 해 전체에서 실제로
 * 해당하는 날짜들을 뽑아준다. buildWorkLogSummary와 같은 "빈 내용은 그 현장의
 * 마지막 내용을 이어받는다" 규칙을 그대로 적용해서 집계 결과와 일치시킨다.
 */
export async function getWorkLogGroupDetail(year: number, siteId: string, title: string): Promise<WorkLogDetailEntry[]> {
  const supabase = await createClient();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  if (!siteId) {
    const { data } = await supabase
      .from("work_logs")
      .select("id, log_date, title, content")
      .is("site_id", null)
      .gte("log_date", start)
      .lte("log_date", end)
      .order("log_date", { ascending: true });
    return (data ?? [])
      .filter((r) => (r.title ?? "").trim() === title)
      .map((r) => ({ id: r.id, log_date: r.log_date, content: r.content }));
  }

  const { data } = await supabase
    .from("work_logs")
    .select("id, log_date, title, content")
    .eq("site_id", siteId)
    .gte("log_date", start)
    .lte("log_date", end)
    .order("log_date", { ascending: true });

  let active = "";
  const result: WorkLogDetailEntry[] = [];
  for (const r of data ?? []) {
    const explicit = (r.title ?? "").trim();
    if (explicit) active = explicit;
    if (active === title) result.push({ id: r.id, log_date: r.log_date, content: r.content });
  }
  return result;
}

export async function updateWorkLogMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const content = String(formData.get("content") ?? "").trim() || null;
  await supabase.from("work_logs").update({ content }).eq("id", id);
  revalidatePath("/worklogs");
  revalidatePath("/reports");
}
