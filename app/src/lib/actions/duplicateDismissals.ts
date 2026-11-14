"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { duplicateKey } from "@/lib/ledgerCheck";

// 장부 점검 "중복 의심" 묶음 숨기기·다시 보이기(106 SQL duplicate_dismissals, 11/14 사용자 요청 "실제로 두 번 산 게 맞는 경우 표에서
// 안 보이게"). 거래는 바꾸지 않음 — 숨김 열쇠(묶음 거래 id들, lib/ledgerCheck.ts의 duplicateKey)만 넣고 지움. 관리자·직원만(RLS).

function idsOf(formData: FormData) {
  return formData.getAll("transaction_ids").map(String).filter(Boolean);
}

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function dismissDuplicateGroup(formData: FormData) {
  const ids = idsOf(formData);
  if (new Set(ids).size < 2) return { error: "숨길 묶음을 찾지 못했습니다." };
  const supabase = await createClient();
  // 이미 숨긴 묶음이면(다른 기기에서 먼저 숨김) 그대로 둠
  const { error } = await supabase
    .from("duplicate_dismissals")
    .upsert({ dup_key: duplicateKey(ids) }, { onConflict: "dup_key", ignoreDuplicates: true });
  if (error) return { error: error.message };
  revalidate();
}

export async function undismissDuplicateGroup(formData: FormData) {
  const ids = idsOf(formData);
  if (new Set(ids).size < 2) return { error: "다시 보이게 할 묶음을 찾지 못했습니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("duplicate_dismissals").delete().eq("dup_key", duplicateKey(ids)).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "다시 보이게 하지 못했습니다(권한이 없거나 이미 다시 보이는 묶음입니다)." };
  revalidate();
}
