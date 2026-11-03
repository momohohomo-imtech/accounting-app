"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/fileUpload";

const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

// 보고서 "고정지출" — 거래처를 고정지출로 지정·해제(101 SQL clients.is_fixed_expense, 사용자 결정 11/3 "DB에 저장"). 바뀐 줄이
// 없으면(조회 전용 계정이거나 지워진 거래처) 된 것처럼 두지 않음.
export async function setClientFixedExpense(clientId: string, fixed: boolean): Promise<{ error?: string }> {
  if (!isUuid(String(clientId ?? ""))) return { error: "잘못된 거래처입니다." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ is_fixed_expense: Boolean(fixed) })
    .eq("id", clientId)
    .select("id");
  if (error) {
    if (MISSING_COLUMN.has(error.code ?? "")) {
      return { error: "고정지출 칸이 아직 없습니다 — Supabase SQL Editor에서 101 SQL을 실행해주세요." };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) return { error: "저장되지 않았습니다(권한이 없거나 지워진 거래처입니다). 화면을 새로 고쳐 주세요." };
  revalidatePath("/reports");
  return {};
}
