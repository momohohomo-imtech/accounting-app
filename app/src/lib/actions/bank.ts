"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseAccount(formData: FormData) {
  return {
    bank_name: String(formData.get("bank_name") ?? ""),
    nickname: String(formData.get("nickname") ?? "") || null,
    account_number: String(formData.get("account_number") ?? "") || null,
    opening_balance: Number(formData.get("opening_balance") ?? 0),
    sort_order: formData.get("sort_order") ? Number(formData.get("sort_order")) : 0,
  };
}

function parseTransaction(formData: FormData) {
  const matchedClientId = String(formData.get("matched_client_id") ?? "") || null;
  return {
    bank_account_id: String(formData.get("bank_account_id")),
    trans_date: String(formData.get("trans_date")),
    description: String(formData.get("description") ?? "") || null,
    direction: String(formData.get("direction") ?? "입금"),
    amount: Number(formData.get("amount") ?? 0),
    matched_client_id: matchedClientId,
    matched_client_name_raw: matchedClientId ? null : String(formData.get("matched_client_name_raw") ?? "") || null,
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
  await supabase.from("bank_transactions").insert(parseTransaction(formData));
  revalidatePath("/bank");
}

// 한 번에 여러 건 등록 — 전부 같은 날짜(trans_date)를 공유한다.
export async function createBankTransactionsBulk(formData: FormData) {
  const supabase = await createClient();
  const transDate = String(formData.get("trans_date") ?? "");
  if (!transDate) return { error: "날짜를 입력해주세요." };

  let rows: {
    bank_account_id: string;
    direction: string;
    amount: number;
    description: string | null;
    matched_client_id: string | null;
    matched_client_name_raw: string | null;
  }[];
  try {
    rows = JSON.parse(String(formData.get("rows_json") ?? "[]"));
  } catch {
    return { error: "입력값을 처리하지 못했습니다." };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "등록할 내역이 없습니다." };
  if (rows.some((r) => !r.bank_account_id || !r.amount)) {
    return { error: "계좌와 금액을 모두 입력해주세요." };
  }

  const inserts = rows.map((r) => ({ ...r, trans_date: transDate }));
  const { error } = await supabase.from("bank_transactions").insert(inserts);
  if (error) return { error: error.message };

  revalidatePath("/bank");
}

// 계좌 간 이체 — 보내는 계좌엔 출금, 받는 계좌엔 입금을 자동으로 한 쌍 생성한다.
export async function createBankTransferRecord(formData: FormData) {
  const supabase = await createClient();
  const fromAccountId = String(formData.get("from_account_id") ?? "");
  const toAccountId = String(formData.get("to_account_id") ?? "");
  const transDate = String(formData.get("trans_date") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const description = String(formData.get("description") ?? "") || null;

  if (!fromAccountId || !toAccountId) return { error: "보내는 계좌와 받는 계좌를 선택해주세요." };
  if (fromAccountId === toAccountId) return { error: "같은 계좌로는 이체할 수 없습니다." };
  if (!transDate) return { error: "날짜를 입력해주세요." };
  if (!amount || amount <= 0) return { error: "금액을 입력해주세요." };

  const transferGroupId = crypto.randomUUID();
  const { error } = await supabase.from("bank_transactions").insert([
    {
      bank_account_id: fromAccountId,
      trans_date: transDate,
      direction: "출금",
      amount,
      description,
      transfer_group_id: transferGroupId,
    },
    {
      bank_account_id: toAccountId,
      trans_date: transDate,
      direction: "입금",
      amount,
      description,
      transfer_group_id: transferGroupId,
    },
  ]);
  if (error) return { error: error.message };

  revalidatePath("/bank");
}

export async function updateBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("bank_transactions").update(parseTransaction(formData)).eq("id", id);
  revalidatePath("/bank");
}

export async function deleteBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: row } = await supabase.from("bank_transactions").select("transfer_group_id").eq("id", id).maybeSingle();
  if (row?.transfer_group_id) {
    // 이체로 자동 생성된 짝이 있으면 같이 지운다 — 한쪽만 남으면 잔액이 어긋나므로.
    await supabase.from("bank_transactions").delete().eq("transfer_group_id", row.transfer_group_id);
  } else {
    await supabase.from("bank_transactions").delete().eq("id", id);
  }
  revalidatePath("/bank");
}
