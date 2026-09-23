"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { remainingBalance } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";

// 거래가 바뀌면 금액이 보이는 모든 화면을 새로 그리게 한다.
function revalidateLedgerPages() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/projects");
}

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

  revalidateLedgerPages();
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

  revalidateLedgerPages();
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

  revalidateLedgerPages();
}

export async function bulkUpdateProjectId(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const projectId = String(formData.get("project_id") ?? "") || null;
  if (ids.length === 0) return { error: "선택된 거래가 없습니다." };

  const { error } = await supabase
    .from("transactions")
    .update({ project_id: projectId, needs_classification: false })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidateLedgerPages();
}

// 거래처는 등록된 거래처(client_id)로 고르거나, 목록에 없으면 이름을 직접 적을 수 있다
// (client_name_raw) — 둘 중 하나만 채우고 나머지는 비운다.
export async function bulkUpdateClientId(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const clientId = String(formData.get("client_id") ?? "") || null;
  const clientNameRaw = clientId ? null : String(formData.get("client_name_raw") ?? "").trim() || null;
  if (ids.length === 0) return { error: "선택된 거래가 없습니다." };

  const { error } = await supabase
    .from("transactions")
    .update({ client_id: clientId, client_name_raw: clientNameRaw })
    .in("id", ids);
  if (error) return { error: error.message };
  revalidateLedgerPages();
}

export async function bulkUpdateCategoryId(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const categoryId = String(formData.get("category_id") ?? "") || null;
  if (ids.length === 0) return { error: "선택된 거래가 없습니다." };

  const { error } = await supabase.from("transactions").update({ category_id: categoryId }).in("id", ids);
  if (error) return { error: error.message };
  revalidateLedgerPages();
}

export async function bulkUpdatePaymentMethodId(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  if (ids.length === 0) return { error: "선택된 거래가 없습니다." };

  const { error } = await supabase.from("transactions").update({ payment_method_id: paymentMethodId }).in("id", ids);
  if (error) return { error: error.message };
  revalidateLedgerPages();
}

export async function bulkUpdateItemName(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const itemName = String(formData.get("item_name") ?? "").trim() || null;
  if (ids.length === 0) return { error: "선택된 거래가 없습니다." };

  const { error } = await supabase.from("transactions").update({ item_name: itemName }).in("id", ids);
  if (error) return { error: error.message };
  revalidateLedgerPages();
}

export async function deleteTransactionRecord(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateLedgerPages();
}

export async function updateTransactionNote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const note1 = String(formData.get("note1") ?? "") || null;
  await supabase.from("transactions").update({ note1 }).eq("id", id);
  revalidatePath("/daily-workers");
  revalidatePath("/transactions");
}

// 외상 여러 건을 정산 → 원본 거래 그대로 장부에 편입(결제수단 지정 + 메모에 정산일/방법 기록),
// 정산 이력(credit_payments)만 별도로 남긴다. 이전에는 별도 합계 거래를 새로 만들었지만, 그러면
// 장부에서 프로젝트/카테고리/품목별 상세가 사라지고 연도별 합계도 원본+합계로 이중 집계됐음.
export async function settleCreditTransactions(formData: FormData) {
  const supabase = await createClient();

  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  const paidDate = String(formData.get("paid_date") ?? "");
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;

  if (ids.length === 0) return { error: "정산할 거래를 선택해주세요." };
  if (!paidDate) return { error: "정산일을 입력해주세요." };

  const [{ data: txs, error: txError }, { data: payments, error: payError }, { data: paymentMethod }] =
    await Promise.all([
      supabase.from("transactions").select("*").in("id", ids),
      supabase.from("credit_payments").select("*").in("transaction_id", ids),
      paymentMethodId
        ? supabase.from("payment_methods").select("name").eq("id", paymentMethodId).single()
        : Promise.resolve({ data: null }),
    ]);
  if (txError || payError) return { error: (txError ?? payError)!.message };

  const existingPayments = (payments ?? []) as CreditPayment[];
  // 이미 완납된 건(중복 제출 등)은 다시 정산하지 않는다 — 메모에 정산일이 두 번 붙는 것 방지.
  const targetTxs = ((txs ?? []) as Transaction[]).filter(
    (tx) => !(existingPayments.some((p) => p.transaction_id === tx.id) && remainingBalance(tx, existingPayments) === 0)
  );
  if (targetTxs.length === 0) return { error: "선택한 거래는 이미 정산됐습니다." };

  // 정산 여부를 결정하는 이력을 먼저 저장 — 이게 실패하면 거래 쪽은 아무것도 안 바뀐 상태로 끝난다.
  const { error: insertError } = await supabase.from("credit_payments").insert(
    targetTxs.map((tx) => ({
      transaction_id: tx.id,
      paid_date: paidDate,
      paid_amount: remainingBalance(tx, existingPayments),
      remaining_amount: 0,
    }))
  );
  if (insertError) return { error: insertError.message };

  const settleNote = `정산일: ${paidDate}${paymentMethod?.name ? ` · ${paymentMethod.name}` : ""}`;
  const updateResults = await Promise.all(
    targetTxs.map((tx) =>
      supabase
        .from("transactions")
        .update({
          payment_method_id: paymentMethodId,
          note2: tx.note2 ? `${tx.note2} / ${settleNote}` : settleNote,
        })
        .eq("id", tx.id)
    )
  );

  revalidateLedgerPages();

  const failed = updateResults.filter((r) => r.error);
  if (failed.length > 0) {
    return { error: `정산은 완료됐지만 ${failed.length}건은 결제수단·메모 기록에 실패했습니다: ${failed[0].error!.message}` };
  }
}
