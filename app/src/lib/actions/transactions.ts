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

// 한 결제로 묶기(092 SQL) — group: 새로 등록하는 이 줄들을 한 결제로 묶음. joinGroupOf: 수정 중인 거래에 줄을 더할 때
// 그 거래와 같은 묶음으로(그 거래에 묶음 번호가 없으면 새로 만들어 그 거래에도 붙임). 둘 다 없으면 예전처럼 따로 등록.
export async function bulkImportTransactions(
  rows: BulkTransactionInput[],
  options: { group?: boolean; joinGroupOf?: string } = {}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (rows.length === 0) return { error: "등록할 행이 없습니다." };

  let paymentGroupId: string | null = null;
  if (options.joinGroupOf) {
    const { data: base, error } = await supabase
      .from("transactions")
      .select("payment_group_id")
      .eq("id", options.joinGroupOf)
      .single();
    if (error) return { error: error.message };
    paymentGroupId = base.payment_group_id ?? crypto.randomUUID();
    if (!base.payment_group_id) {
      const { error: baseError } = await supabase
        .from("transactions")
        .update({ payment_group_id: paymentGroupId })
        .eq("id", options.joinGroupOf);
      if (baseError) return { error: baseError.message };
    }
  } else if (options.group && rows.length > 1) {
    paymentGroupId = crypto.randomUUID();
  }

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
    // 묶지 않을 때는 칸을 아예 안 보냄 — 092 SQL 실행 전에도 등록이 깨지지 않게.
    ...(paymentGroupId ? { payment_group_id: paymentGroupId } : {}),
  }));

  const { error } = await supabase.from("transactions").insert(inserts);
  if (error) return { error: error.message };

  revalidateLedgerPages();
}

export type GroupLineInput = BulkTransactionInput & { id?: string };

// 묶음 전체 수정 — 줄 수정·추가·삭제를 한 번에. keepGroup이 꺼져 있거나 한 줄만 남으면 묶음을 푼다.
// 중간에 실패해도 데이터가 덜 사라지게 수정 → 추가 → 삭제 순서, 삭제는 이 묶음의 줄만(묶음 번호로 한 번 더 거름).
export async function saveTransactionGroup(input: {
  groupId: string;
  lines: GroupLineInput[];
  removedIds: string[];
  keepGroup: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (input.lines.length === 0) return { error: "저장할 줄이 없습니다." };
  const paymentGroupId = input.keepGroup && input.lines.length > 1 ? input.groupId : null;

  const fieldsOf = (r: BulkTransactionInput) => ({
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
    needs_classification: r.needs_classification,
    note1: r.note1,
    note2: r.note2,
    payment_group_id: paymentGroupId,
  });

  const updates = await Promise.all(
    input.lines
      .filter((l) => l.id)
      .map((l) => supabase.from("transactions").update(fieldsOf(l)).eq("id", l.id!))
  );
  const updateError = updates.find((r) => r.error)?.error;
  if (updateError) return { error: updateError.message };

  const inserts = input.lines
    .filter((l) => !l.id)
    .map((l) => ({ ...fieldsOf(l), is_verified_ai: true, created_by: user?.id ?? null }));
  if (inserts.length > 0) {
    const { error } = await supabase.from("transactions").insert(inserts);
    if (error) return { error: error.message };
  }

  if (input.removedIds.length > 0) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", input.removedIds)
      .eq("payment_group_id", input.groupId);
    if (error) return { error: error.message };
  }

  revalidateLedgerPages();
}

// 매입장에서 고른 거래들을 한 결제로 묶음 — 같은 구분끼리만, 날짜도 같아야 함(묶음이 다른 달로 갈라지지 않게). 단 외상
// 정산분은 여러 날의 계산서를 한 번에 갚는 것이라 날짜가 달라도 됨(매입장에서는 계산서 날짜 범위로 표시).
export async function groupTransactions(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  if (ids.length < 2) return { error: "묶을 거래를 2건 이상 선택해주세요." };

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id, trans_date, type, payment_type")
    .in("id", ids);
  if (error) return { error: error.message };
  if (new Set((rows ?? []).map((r) => r.type)).size > 1) return { error: "매입과 매출은 함께 묶을 수 없습니다." };
  const allCredit = (rows ?? []).every((r) => r.payment_type === "credit");
  if (!allCredit && new Set((rows ?? []).map((r) => r.trans_date)).size > 1) {
    return { error: "날짜가 같은 거래끼리만 묶을 수 있습니다(외상 정산분끼리는 날짜가 달라도 됩니다)." };
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ payment_group_id: crypto.randomUUID() })
    .in("id", ids);
  if (updateError) return { error: updateError.message };
  revalidateLedgerPages();
}

// 묶음 풀기 — 고른 거래만 묶음에서 빼서 매입장에 따로 보이게(금액·프로젝트는 그대로).
export async function ungroupTransactions(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "선택된 거래가 없습니다." };

  const { error } = await supabase.from("transactions").update({ payment_group_id: null }).in("id", ids);
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

// 묶음 삭제 — 한 결제로 묶인 줄 전부.
export async function deleteTransactionRecords(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("transaction_ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "삭제할 거래가 없습니다." };
  const { error } = await supabase.from("transactions").delete().in("id", ids);
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
  // 한 번에 정산한 여러 건은 한 결제로 묶음(092) — 매입장에 한 줄로. 묶지 않을 땐 칸을 아예 안 보냄(092 실행 전 대비).
  const paymentGroupId = formData.get("group_payment") === "on" && targetTxs.length > 1 ? crypto.randomUUID() : null;
  const updateResults = await Promise.all(
    targetTxs.map((tx) =>
      supabase
        .from("transactions")
        .update({
          payment_method_id: paymentMethodId,
          note2: tx.note2 ? `${tx.note2} / ${settleNote}` : settleNote,
          ...(paymentGroupId ? { payment_group_id: paymentGroupId } : {}),
        })
        .eq("id", tx.id)
    )
  );

  revalidateLedgerPages();

  const failed = updateResults.filter((r) => r.error);
  if (failed.length > 0) {
    // credit_payments는 이미 전부 등록돼 정산 자체는 끝난 상태(결제수단·메모만 일부 실패) —
    // settled: true로 호출 쪽에 알려서 선택 목록을 비우게 한다(안 비우면 다음 제출 때 이미
    // 정산된 거래id가 다시 섞여 들어간다).
    return {
      error: `정산은 완료됐지만 ${failed.length}건은 결제수단·메모 기록에 실패했습니다: ${failed[0].error!.message}`,
      settled: true,
    };
  }
}
