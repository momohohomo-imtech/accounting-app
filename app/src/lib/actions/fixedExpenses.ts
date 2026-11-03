"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/fileUpload";

const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

// 보고서 "고정지출" — 거래처(101 SQL clients.is_fixed_expense)·카테고리(102 SQL expense_categories.is_fixed_expense)를 고정지출로
// 지정·해제(사용자 결정 11/3 "DB에 저장"). 바뀐 줄이 없으면(조회 전용 계정이거나 지워진 항목) 된 것처럼 두지 않음.
async function setFixed(
  table: "clients" | "expense_categories",
  id: string,
  fixed: boolean,
  labels: { item: string; sql: string }
): Promise<{ error?: string }> {
  if (!isUuid(String(id ?? ""))) return { error: `잘못된 ${labels.item}입니다.` };
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).update({ is_fixed_expense: Boolean(fixed) }).eq("id", id).select("id");
  if (error) {
    if (MISSING_COLUMN.has(error.code ?? "")) {
      return { error: `${labels.item} 고정지출 칸이 아직 없습니다 — Supabase SQL Editor에서 ${labels.sql} SQL을 실행해주세요.` };
    }
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: `저장되지 않았습니다(권한이 없거나 지워진 ${labels.item}입니다). 화면을 새로 고쳐 주세요.` };
  }
  revalidatePath("/reports");
  return {};
}

export async function setClientFixedExpense(clientId: string, fixed: boolean): Promise<{ error?: string }> {
  return setFixed("clients", clientId, fixed, { item: "거래처", sql: "101" });
}

export async function setCategoryFixedExpense(categoryId: string, fixed: boolean): Promise<{ error?: string }> {
  return setFixed("expense_categories", categoryId, fixed, { item: "카테고리", sql: "102" });
}
