"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertHalfYearProfit(formData: FormData): Promise<{ error?: string } | void> {
  const year = Number(formData.get("year"));
  const half = Number(formData.get("half") ?? 1);
  const amountRaw = formData.get("amount");
  const amount = amountRaw === null || amountRaw === "" ? NaN : Number(amountRaw);
  if (!year || Number.isNaN(amount)) return { error: "잘못된 값입니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("half_year_settlements")
    .upsert({ year, half, profit_amount: amount }, { onConflict: "year,half" });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
}

// 부가가치세 예정고지서 금액(093 SQL) — 빈칸으로 저장하면 지워서 장부 기준 추정으로 되돌림.
export async function upsertVatPrepaymentNotice(formData: FormData): Promise<{ error?: string } | void> {
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amountRaw = String(formData.get("amount") ?? "").trim();
  if (!Number.isInteger(year) || (month !== 4 && month !== 10)) return { error: "잘못된 값입니다." };

  const supabase = await createClient();
  if (amountRaw === "") {
    const { error } = await supabase.from("vat_prepayment_notices").delete().eq("year", year).eq("month", month);
    if (error) return { error: error.message };
  } else {
    const amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount < 0) return { error: "금액이 올바르지 않습니다." };
    const { error } = await supabase
      .from("vat_prepayment_notices")
      .upsert({ year, month, amount, updated_at: new Date().toISOString() }, { onConflict: "year,month" });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
}
