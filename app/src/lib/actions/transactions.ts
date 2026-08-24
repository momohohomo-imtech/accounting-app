"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { remainingBalance } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";

function computeAmounts(type: string, amount: number, vatIncluded: boolean) {
  const vat = vatIncluded ? Math.round(amount / 11) : Math.round(amount * 0.1);
  const base = vatIncluded ? amount - vat : amount;
  if (type === "매출") {
    return { sales_amount: base, sales_vat: vat, purchase_amount: 0, purchase_vat: 0 };
  }
  return { purchase_amount: base, purchase_vat: vat, sales_amount: 0, sales_vat: 0 };
}

export async function createTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const type = String(formData.get("type") ?? "매입");
  const vatIncluded = formData.get("vat_included") === "on";
  const amount = Number(formData.get("amount") ?? 0);
  const amounts = computeAmounts(type, amount, vatIncluded);

  const ocrRaw = String(formData.get("ocr_extracted_raw") ?? "");

  await supabase.from("transactions").insert({
    trans_date: String(formData.get("trans_date")),
    type,
    client_id: String(formData.get("client_id") ?? "") || null,
    client_name_raw: String(formData.get("client_name_raw") ?? "") || null,
    project_id: String(formData.get("project_id") ?? "") || null,
    item_name: String(formData.get("item_name") ?? "") || null,
    category_id: String(formData.get("category_id") ?? "") || null,
    quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
    unit_price: formData.get("unit_price") ? Number(formData.get("unit_price")) : null,
    payment_method_id: String(formData.get("payment_method_id") ?? "") || null,
    tax_invoice_issued: formData.get("tax_invoice_issued") === "on",
    vat_included: vatIncluded,
    ...amounts,
    payment_type: String(formData.get("payment_type") ?? "immediate"),
    is_verified_ai: formData.get("is_verified_ai") === "on",
    receipt_image_url: String(formData.get("receipt_image_url") ?? "") || null,
    ocr_extracted_raw: ocrRaw ? JSON.parse(ocrRaw) : null,
    note1: String(formData.get("note1") ?? "") || null,
    note2: String(formData.get("note2") ?? "") || null,
    created_by: user?.id ?? null,
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect("/transactions");
}

export async function updateTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const type = String(formData.get("type") ?? "매입");
  const vatIncluded = formData.get("vat_included") === "on";
  const amount = Number(formData.get("amount") ?? 0);
  const amounts = computeAmounts(type, amount, vatIncluded);

  await supabase
    .from("transactions")
    .update({
      trans_date: String(formData.get("trans_date")),
      type,
      client_id: String(formData.get("client_id") ?? "") || null,
      client_name_raw: String(formData.get("client_name_raw") ?? "") || null,
      project_id: String(formData.get("project_id") ?? "") || null,
      item_name: String(formData.get("item_name") ?? "") || null,
      category: String(formData.get("category") ?? "") || null,
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
      unit_price: formData.get("unit_price") ? Number(formData.get("unit_price")) : null,
      payment_method_id: String(formData.get("payment_method_id") ?? "") || null,
      tax_invoice_issued: formData.get("tax_invoice_issued") === "on",
      vat_included: vatIncluded,
      ...amounts,
      payment_type: String(formData.get("payment_type") ?? "immediate"),
      note1: String(formData.get("note1") ?? "") || null,
      note2: String(formData.get("note2") ?? "") || null,
    })
    .eq("id", id);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
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
