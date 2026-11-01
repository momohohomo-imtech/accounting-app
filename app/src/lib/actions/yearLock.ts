"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/currentRole";

// 신고 끝난 해 잠그기·풀기(097 SQL) — 관리자만(DB 정책도 관리자만 허용). 설명은 lib/yearLock.ts.
function parseYear(formData: FormData) {
  const year = Number(formData.get("year"));
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function revalidateLockPages() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function lockYear(formData: FormData) {
  const year = parseYear(formData);
  if (!year) return { error: "잘못된 연도입니다." };
  if ((await getCurrentRole()) !== "admin") return { error: "관리자만 잠글 수 있습니다." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("locked_years")
    .upsert({ year, memo: String(formData.get("memo") ?? "").trim() || null }, { onConflict: "year" });
  if (error) return { error: error.message };
  revalidateLockPages();
}

export async function unlockYear(formData: FormData) {
  const year = parseYear(formData);
  if (!year) return { error: "잘못된 연도입니다." };
  if ((await getCurrentRole()) !== "admin") return { error: "관리자만 잠금을 풀 수 있습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("locked_years").delete().eq("year", year);
  if (error) return { error: error.message };
  revalidateLockPages();
}
