"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    category: String(formData.get("category") ?? "") || null,
    quantity: formData.get("quantity") ? Number(formData.get("quantity")) : null,
    unit_price: formData.get("unit_price") ? Number(formData.get("unit_price")) : null,
    card_company: String(formData.get("card_company") ?? "") || null,
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
      card_company: String(formData.get("card_company") ?? "") || null,
      vat_included: vatIncluded,
      ...amounts,
      payment_type: String(formData.get("payment_type") ?? "immediate"),
      note1: String(formData.get("note1") ?? "") || null,
      note2: String(formData.get("note2") ?? "") || null,
    })
    .eq("id", id);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function deleteTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function addCreditPaymentRecord(formData: FormData) {
  const supabase = await createClient();
  const transactionId = String(formData.get("transaction_id"));
  const paidAmount = Number(formData.get("paid_amount") ?? 0);
  const currentRemaining = Number(formData.get("current_remaining") ?? 0);

  await supabase.from("credit_payments").insert({
    transaction_id: transactionId,
    paid_date: String(formData.get("paid_date")),
    paid_amount: paidAmount,
    remaining_amount: Math.max(currentRemaining - paidAmount, 0),
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
