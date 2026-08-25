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
    if (!title) continue;
    const color = String(formData.get(`color_${i}`) ?? "none");
    rows.push({ log_date: logDate, title, color, sort_order: i });
  }
  if (rows.length) await supabase.from("work_logs").insert(rows);

  const [year, month] = logDate.split("-");
  redirect(`/worklogs?year=${Number(year)}&month=${Number(month)}`);
}
