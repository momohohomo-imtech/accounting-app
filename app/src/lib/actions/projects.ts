"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const estimated = formData.get("contract_amount_estimated") === "on";
  return {
    site_id: String(formData.get("site_id")),
    parent_project_id: String(formData.get("parent_project_id") ?? "") || null,
    name: String(formData.get("name") ?? ""),
    status: String(formData.get("status") ?? "ongoing"),
    is_service: formData.get("is_service") === "on",
    start_date: String(formData.get("start_date") ?? "") || null,
    end_date: String(formData.get("end_date") ?? "") || null,
    progress_pct: formData.get("progress_pct") ? Number(formData.get("progress_pct")) : 0,
    year: Number(formData.get("year") ?? new Date().getFullYear()),
    quote_amount: formData.get("quote_amount") ? Number(formData.get("quote_amount")) : null,
    contract_amount: formData.get("contract_amount") ? Number(formData.get("contract_amount")) : null,
    contract_amount_estimated: estimated,
    // 두 구분은 동시에 체크될 수 없으므로, 예상금액이 체크된 경우 최소금액 산정액은 무시한다.
    contract_amount_minimum: !estimated && formData.get("contract_amount_minimum") === "on",
    order_date: String(formData.get("order_date") ?? "") || null,
    memo: String(formData.get("memo") ?? "") || null,
  };
}

export async function createProjectRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert(parse(formData));
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function updateProjectRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("projects").update(parse(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/projects");
}

export async function updateProjectMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const memo = String(formData.get("memo") ?? "") || null;
  await supabase.from("projects").update({ memo }).eq("id", id);
  revalidatePath("/projects");
  revalidatePath("/reports");
}

export async function updateProjectSettlementFinalized(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const settlementFinalized = formData.get("settlement_finalized") === "on";
  await supabase.from("projects").update({ settlement_finalized: settlementFinalized }).eq("id", id);
  revalidatePath("/projects");
  revalidatePath("/reports");
}

export async function deleteProjectRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/projects");
}
