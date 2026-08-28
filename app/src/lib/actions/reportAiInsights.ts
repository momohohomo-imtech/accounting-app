"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveReportAiInsight(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const year = Number(formData.get("year"));
  const title = String(formData.get("title") ?? "");
  const messages = JSON.parse(String(formData.get("messages") ?? "[]"));

  await supabase.from("report_ai_insights").insert({ year, title, messages, created_by: user?.id ?? null });
  revalidatePath("/reports");
}

export async function deleteReportAiInsight(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("report_ai_insights").delete().eq("id", id);
  revalidatePath("/reports");
}
