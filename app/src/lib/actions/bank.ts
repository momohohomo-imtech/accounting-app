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
  const { error } = await supabase.from("bank_accounts").insert(parseAccount(formData));
  if (error) return { error: error.message };
  revalidatePath("/bank");
}

export async function updateBankAccountRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("bank_accounts").update(parseAccount(formData)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/bank");
}

export async function updateBankAccountMemo(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const memo = String(formData.get("memo") ?? "") || null;
  const { error } = await supabase.from("bank_accounts").update({ memo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/bank");
}

export async function deleteBankAccountRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/bank");
}

export async function createBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("bank_transactions").insert(parseTransaction(formData));
  if (error) return { error: error.message };
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
  // 0원 항목도 유효한 값 — 계좌 미선택이거나 금액이 아예 숫자가 아닌 경우만 막는다.
  if (rows.some((r) => !r.bank_account_id || typeof r.amount !== "number" || Number.isNaN(r.amount))) {
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

type BankTxForLedger = {
  trans_date: string;
  direction: string;
  amount: number;
  description: string | null;
  matched_client_id: string | null;
  matched_client_name_raw: string | null;
  bank_accounts?: { nickname: string | null; bank_name: string } | null;
  clients?: { name: string } | null;
};

const BANK_TX_FOR_LEDGER_SELECT = "*, bank_accounts(nickname, bank_name), clients(name)";

// 은행 거래 한 건을 매입/매출장에 "분류 대기 중"으로 올릴 때 넣는 값 — 등록할 때와, 나중에
// "등록 당시 그대로인지" 비교할 때 둘 다 이 함수 하나로 만들어서 기준이 어긋나지 않게 한다.
function ledgerRowFromBank(bankTx: BankTxForLedger) {
  const isPurchase = bankTx.direction === "출금";
  const accountName = bankTx.bank_accounts?.nickname ?? bankTx.bank_accounts?.bank_name ?? "";
  // 매칭 거래처 이름을 품목으로 — 매칭 거래처가 없으면 내용(적요)으로 대신한다.
  const matchedClientName = bankTx.clients?.name ?? bankTx.matched_client_name_raw ?? null;
  return {
    trans_date: bankTx.trans_date,
    type: isPurchase ? "매입" : "매출",
    client_id: bankTx.matched_client_id,
    client_name_raw: bankTx.matched_client_name_raw,
    item_name: matchedClientName ?? bankTx.description,
    purchase_amount: isPurchase ? bankTx.amount : 0,
    purchase_vat: 0,
    sales_amount: isPurchase ? 0 : bankTx.amount,
    sales_vat: 0,
    payment_type: "immediate",
    vat_included: false,
    tax_invoice_issued: false,
    needs_classification: true,
    note1: `[은행] ${accountName}${bankTx.description ? ` · ${bankTx.description}` : ""}`,
  };
}

// 은행 거래내역 체크박스 ON — 매입/매출장(transactions)에 "분류 대기 중" 상태로 자동 등록.
// 출금이면 매입, 입금이면 매출로 넣는다. 계좌 간 이체 건은 실제 매입/매출이 아니라 올릴 수 없음.
export async function promoteBankTransactionToLedger(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: bankTx } = await supabase
    .from("bank_transactions")
    .select(BANK_TX_FOR_LEDGER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!bankTx) return { error: "거래내역을 찾을 수 없습니다." };
  if (bankTx.promoted_transaction_id) return {};
  if (bankTx.transfer_group_id) return { error: "계좌 간 이체 내역은 매입/매출장으로 올릴 수 없습니다." };

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert(ledgerRowFromBank(bankTx))
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "매입/매출장 등록에 실패했습니다." };

  await supabase.from("bank_transactions").update({ promoted_transaction_id: inserted.id }).eq("id", id);
  revalidatePath("/bank");
  revalidatePath("/transactions");
}

const CLASSIFIED_LEDGER_ERROR =
  "매입/매출장에서 이미 분류하거나 수정한 내역이라 여기서 지우지 않았습니다. 매입/매출장에서 직접 삭제한 뒤 다시 시도해주세요.";

// 자동 등록된 장부 내역이 등록 당시 그대로인지 — 등록 때 넣은 값(ledgerRowFromBank)과 모든 칸이
// 같고, 등록 때 비워둔 칸(프로젝트·카테고리·결제수단·메모2·수량·단가)도 여전히 비어 있을 때만
// true. 하나라도 다르면 누군가 장부에서 손댄 것이라 은행 쪽 취소/삭제와 함께 지우지 않는다.
// 조회 자체가 실패하면 판단할 수 없으니 지우지 않는 쪽(false)으로.
async function isLedgerUntouched(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ledgerId: string,
  bankTx: BankTxForLedger
) {
  const { data: ledger, error } = await supabase.from("transactions").select("*").eq("id", ledgerId).maybeSingle();
  if (error) return false;
  if (!ledger) return true;
  const expected = ledgerRowFromBank(bankTx);
  const sameValue = (a: unknown, b: unknown) =>
    typeof b === "number" ? Number(a) === b : (a ?? null) === (b ?? null);
  const unchanged = (Object.keys(expected) as (keyof typeof expected)[]).every((k) => sameValue(ledger[k], expected[k]));
  const stillEmpty = ["project_id", "category_id", "payment_method_id", "note2", "quantity", "unit_price"].every(
    (k) => ledger[k] === null || ledger[k] === undefined
  );
  return unchanged && stillEmpty;
}

// 체크 해제 — 자동으로 만들어졌던 매입/매출장 내역을 같이 지운다(아직 손대지 않은 경우만).
export async function unpromoteBankTransactionFromLedger(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: bankTx } = await supabase
    .from("bank_transactions")
    .select(BANK_TX_FOR_LEDGER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (bankTx?.promoted_transaction_id) {
    if (!(await isLedgerUntouched(supabase, bankTx.promoted_transaction_id, bankTx))) {
      return { error: CLASSIFIED_LEDGER_ERROR };
    }
    const del = await supabase.from("transactions").delete().eq("id", bankTx.promoted_transaction_id);
    if (del.error) return { error: del.error.message };
    const upd = await supabase.from("bank_transactions").update({ promoted_transaction_id: null }).eq("id", id);
    if (upd.error) return { error: upd.error.message };
  }
  revalidatePath("/bank");
  revalidatePath("/transactions");
}

export async function updateBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const patch = parseTransaction(formData);

  const { data: existing } = await supabase
    .from("bank_transactions")
    .select(BANK_TX_FOR_LEDGER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { error: "거래내역을 찾을 수 없습니다." };

  // 매입/매출장에 올라간 건은 금액·날짜·입출금을 바꾸면 장부와 어긋나므로 막는다.
  if (
    existing.promoted_transaction_id &&
    (patch.amount !== Number(existing.amount) ||
      patch.trans_date !== existing.trans_date ||
      patch.direction !== existing.direction)
  ) {
    return {
      error:
        "매입/매출장에 등록된 거래는 금액·날짜·입출금을 바꿀 수 없습니다. 매입/매출장에서 수정하거나, 등록을 취소한 뒤 수정해주세요.",
    };
  }

  // 승인 후 아직 미분류(untouched)인 장부 내역은 은행 쪽 내용·거래처 수정에 맞춰 같이 갱신 —
  // 안 그러면 이 수정 때문에 isLedgerUntouched의 "등록 당시 그대로인지" 비교 기준이 어긋나서
  // 실제로는 손대지 않은 장부인데도 취소/삭제가 막히게 된다.
  const shouldSyncLedger =
    !!existing.promoted_transaction_id && (await isLedgerUntouched(supabase, existing.promoted_transaction_id, existing));

  if (existing.transfer_group_id) {
    // 이체는 입출금 방향을 바꿀 수 없고, 날짜·금액·내용은 짝에도 똑같이 반영해서 잔액이 어긋나지 않게 한다.
    const { data: pair } = await supabase
      .from("bank_transactions")
      .select("id, bank_account_id")
      .eq("transfer_group_id", existing.transfer_group_id)
      .neq("id", id)
      .maybeSingle();
    if (pair && pair.bank_account_id === patch.bank_account_id) {
      return { error: "이체의 보내는 계좌와 받는 계좌가 같아질 수 없습니다." };
    }
    if (!patch.amount || patch.amount <= 0) return { error: "금액을 입력해주세요." };

    const { error } = await supabase
      .from("bank_transactions")
      .update({ ...patch, direction: existing.direction })
      .eq("id", id);
    if (error) return { error: error.message };
    if (pair) {
      const { error: pairError } = await supabase
        .from("bank_transactions")
        .update({ trans_date: patch.trans_date, amount: patch.amount, description: patch.description })
        .eq("id", pair.id);
      if (pairError) return { error: `이체 짝 반영 실패: ${pairError.message}` };
    }
    revalidatePath("/bank");
    return;
  }

  const { error } = await supabase.from("bank_transactions").update(patch).eq("id", id);
  if (error) return { error: error.message };

  if (shouldSyncLedger && existing.promoted_transaction_id) {
    let clientName = existing.clients?.name ?? null;
    if (patch.matched_client_id !== existing.matched_client_id) {
      if (patch.matched_client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", patch.matched_client_id)
          .maybeSingle();
        clientName = client?.name ?? null;
      } else {
        clientName = null;
      }
    }
    const synced = ledgerRowFromBank({ ...existing, ...patch, clients: clientName ? { name: clientName } : null });
    const { error: syncError } = await supabase
      .from("transactions")
      .update({
        item_name: synced.item_name,
        client_id: synced.client_id,
        client_name_raw: synced.client_name_raw,
        note1: synced.note1,
      })
      .eq("id", existing.promoted_transaction_id);
    if (syncError) return { error: `장부 반영 실패: ${syncError.message}` };
  }

  revalidatePath("/bank");
  revalidatePath("/transactions");
}

export async function deleteBankTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: row } = await supabase
    .from("bank_transactions")
    .select(BANK_TX_FOR_LEDGER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (row?.promoted_transaction_id) {
    // 매입/매출장으로 올라가 있던 자동 등록 내역도 같이 지운다 — 장부에서 이미 손댄 건 보호.
    if (!(await isLedgerUntouched(supabase, row.promoted_transaction_id, row))) {
      return { error: CLASSIFIED_LEDGER_ERROR };
    }
    const { error } = await supabase.from("transactions").delete().eq("id", row.promoted_transaction_id);
    if (error) return { error: error.message };
  }
  if (row?.transfer_group_id) {
    // 이체로 자동 생성된 짝이 있으면 같이 지운다 — 한쪽만 남으면 잔액이 어긋나므로.
    const { error } = await supabase.from("bank_transactions").delete().eq("transfer_group_id", row.transfer_group_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("bank_transactions").delete().eq("id", id);
    if (error) return { error: error.message };
  }
  revalidatePath("/bank");
  revalidatePath("/transactions");
}
