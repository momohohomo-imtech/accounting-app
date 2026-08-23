"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseAccount(formData: FormData) {
  return {
    bank_name: String(formData.get("bank_name") ?? ""),
    nickname: String(formData.get("nickname") ?? "") || null,
    account_number: String(formData.get("account_number") ?? "") || null,
    opening_balance: Number(formData.get("opening_balance") ?? 0),
  };
}

export async function createBankAccountRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("bank_accounts").insert(parseAccount(formData));
  revalidatePath("/bank");
}

export async function updateBankAccountRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("bank_accounts").update(parseAccount(formData)).eq("id", id);
  revalidatePath("/bank");
}

export async function deleteBankAccountRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("bank_accounts").delete().eq("id", id);
  revalidatePath("/bank");
}

export async function createBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("bank_transactions").insert({
    bank_account_id: String(formData.get("bank_account_id")),
    trans_date: String(formData.get("trans_date")),
    description: String(formData.get("description") ?? "") || null,
    direction: String(formData.get("direction") ?? "입금"),
    amount: Number(formData.get("amount") ?? 0),
    matched_client_id: String(formData.get("matched_client_id") ?? "") || null,
  });
  revalidatePath("/bank");
}

export async function deleteBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("bank_transactions").delete().eq("id", id);
  revalidatePath("/bank");
}
