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
