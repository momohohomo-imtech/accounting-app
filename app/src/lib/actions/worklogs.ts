"use server";

import { redirect } from "next/navigation";
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
