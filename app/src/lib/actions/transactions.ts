"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { remainingBalance } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";

// addVat 체크 시에만 입력 금액의 10%를 얹어서 합계에 더함. 체크 안 하면(기본값) 입력한 금액이
// 곧 최종 합계이고 부가세는 0 — "얼마인지 모르니 자동으로 계산해준다"는 동작은 없음, 항상 사용자가
// 명시적으로 체크해야만 10%가 붙음.
function computeAmounts(type: string, amount: number, addVat: boolean) {
  const vat = addVat ? Math.round(amount * 0.1) : 0;
  if (type === "매출") {
    return { sales_amount: amount, sales_vat: vat, purchase_amount: 0, purchase_vat: 0 };
  }
  return { purchase_amount: amount, purchase_vat: vat, sales_amount: 0, sales_vat: 0 };
}

export async function createTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const type = String(formData.get("type") ?? "매입");
  const vatIncluded = formData.get("vat_included") === "on";
  const amount = Number(formData.get("amount") ?? 0);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const amounts = computeAmounts(type, amount, vatIncluded);

  const ocrRaw = String(formData.get("ocr_extracted_raw") ?? "");

  const { error } = await supabase.from("transactions").insert({
    trans_date: String(formData.get("trans_date")),
    type,
    client_id: String(formData.get("client_id") ?? "") || null,
    client_name_raw: String(formData.get("client_name_raw") ?? "") || null,
    project_id: String(formData.get("project_id") ?? "") || null,
    item_name: String(formData.get("item_name") ?? "") || null,
    category_id: categoryId,
    quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
    unit_price: formData.get("unit_price") ? Number(formData.get("unit_price")) : null,
    payment_method_id: String(formData.get("payment_method_id") ?? "") || null,
    tax_invoice_issued: formData.get("tax_invoice_issued") === "on",
    vat_included: vatIncluded,
    ...amounts,
    payment_type: String(formData.get("payment_type") ?? "immediate"),
    is_verified_ai: formData.get("is_verified_ai") === "on",
    needs_classification: formData.get("needs_classification") === "on",
    receipt_image_url: String(formData.get("receipt_image_url") ?? "") || null,
    ocr_extracted_raw: ocrRaw ? JSON.parse(ocrRaw) : null,
    note1: String(formData.get("note1") ?? "") || null,
    note2: String(formData.get("note2") ?? "") || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function updateTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const type = String(formData.get("type") ?? "매입");
  const vatIncluded = formData.get("vat_included") === "on";
  const amount = Number(formData.get("amount") ?? 0);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const amounts = computeAmounts(type, amount, vatIncluded);

  const { error } = await supabase
    .from("transactions")
    .update({
      trans_date: String(formData.get("trans_date")),
      type,
      client_id: String(formData.get("client_id") ?? "") || null,
      client_name_raw: String(formData.get("client_name_raw") ?? "") || null,
      project_id: String(formData.get("project_id") ?? "") || null,
      item_name: String(formData.get("item_name") ?? "") || null,
      category_id: categoryId,
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
      unit_price: formData.get("unit_price") ? Number(formData.get("unit_price")) : null,
      payment_method_id: String(formData.get("payment_method_id") ?? "") || null,
      tax_invoice_issued: formData.get("tax_invoice_issued") === "on",
      vat_included: vatIncluded,
      ...amounts,
      payment_type: String(formData.get("payment_type") ?? "immediate"),
      needs_classification: formData.get("needs_classification") === "on",
      note1: String(formData.get("note1") ?? "") || null,
      note2: String(formData.get("note2") ?? "") || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export type BulkTransactionInput = {
  trans_date: string;
  type: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  item_name: string | null;
  category_id: string | null;
  quantity: number | null;
  unit_price: number | null;
  payment_method_id: string | null;
  payment_type: string;
  tax_invoice_issued: boolean;
  vat_included: boolean;
  needs_classification: boolean;
  amount: number;
  note1: string | null;
  note2: string | null;
};

export async function bulkImportTransactions(rows: BulkTransactionInput[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (rows.length === 0) return { error: "등록할 행이 없습니다." };

  const inserts = rows.map((r) => ({
    trans_date: r.trans_date,
    type: r.type,
    client_id: r.client_id,
    client_name_raw: r.client_name_raw,
    project_id: r.project_id,
    item_name: r.item_name,
    category_id: r.category_id,
    quantity: r.quantity,
    unit_price: r.unit_price,
    payment_method_id: r.payment_method_id,
    tax_invoice_issued: r.tax_invoice_issued,
    vat_included: r.vat_included,
    ...computeAmounts(r.type, r.amount, r.vat_included),
    payment_type: r.payment_type,
    is_verified_ai: true,
    needs_classification: r.needs_classification,
    note1: r.note1,
    note2: r.note2,
    created_by: user?.id ?? null,
  }));

  const { error } = await supabase.from("transactions").insert(inserts);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function bulkUpdateProjectId(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const projectId = String(formData.get("project_id") ?? "") || null;
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("transactions")
    .update({ project_id: projectId, needs_classification: false })
    .in("id", ids);
  if (error) console.error("bulkUpdateProjectId failed:", error.message);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function deleteTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function updateTransactionNote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const note1 = String(formData.get("note1") ?? "") || null;
  await supabase.from("transactions").update({ note1 }).eq("id", id);
  revalidatePath("/daily-workers");
  revalidatePath("/transactions");
}

// 외상 여러 건을 같은 날짜로 정산 → 매입매출장에 합계 1건(세금계산서 발행) 자동 생성
export async function settleCreditTransactions(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const paidDate = String(formData.get("paid_date") ?? "");
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const clientId = String(formData.get("client_id") ?? "") || null;
  const clientNameRaw = String(formData.get("client_name_raw") ?? "") || null;

  if (ids.length === 0 || !paidDate) {
    revalidatePath("/transactions");
    return;
  }

  const [{ data: txs }, { data: payments }] = await Promise.all([
    supabase.from("transactions").select("*").in("id", ids),
    supabase.from("credit_payments").select("*").in("transaction_id", ids),
  ]);

  const targetTxs = (txs ?? []) as Transaction[];
  const existingPayments = (payments ?? []) as CreditPayment[];
  if (targetTxs.length === 0) return;

  const type = targetTxs[0].type;
  const purchase_amount = targetTxs.reduce((s, t) => s + t.purchase_amount, 0);
  const purchase_vat = targetTxs.reduce((s, t) => s + t.purchase_vat, 0);
  const sales_amount = targetTxs.reduce((s, t) => s + t.sales_amount, 0);
  const sales_vat = targetTxs.reduce((s, t) => s + t.sales_vat, 0);

  const originalDates = Array.from(new Set(targetTxs.map((t) => t.trans_date))).sort();

  const { data: settlementTx, error: settlementError } = await supabase
    .from("transactions")
    .insert({
      trans_date: paidDate,
      type,
      client_id: clientId,
      client_name_raw: clientNameRaw,
      project_id: null,
      item_name: `외상 정산 (${targetTxs.length}건)`,
      payment_method_id: paymentMethodId,
      tax_invoice_issued: true,
      vat_included: true,
      purchase_amount,
      purchase_vat,
      sales_amount,
      sales_vat,
      payment_type: "immediate",
      is_verified_ai: false,
      note2: `실 ${type}일자: ${originalDates.join(", ")}`,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (settlementError || !settlementTx) {
    revalidatePath("/transactions");
    return;
  }

  const creditPaymentRows = targetTxs.map((tx) => ({
    transaction_id: tx.id,
    paid_date: paidDate,
    paid_amount: remainingBalance(tx, existingPayments),
    remaining_amount: 0,
    settlement_transaction_id: settlementTx.id,
  }));

  await supabase.from("credit_payments").insert(creditPaymentRows);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
