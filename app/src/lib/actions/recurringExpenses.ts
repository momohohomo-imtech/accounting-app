"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/currentRole";
import { nowKstParts } from "@/lib/kstDate";
import { postDueRecurring } from "@/lib/recurringExpensePost";
import { countSavedIds } from "@/lib/supabaseFetchAll";
import { NEW_ID_FIELD, insertOnce, validNewIds } from "@/lib/idempotentSave";

// 매입매출 "고정지출" 탭(108 SQL recurring_expenses) — 항목 추가·수정·삭제와 "지금 올리기". 자동으로 올린 매입 줄은 장부 자료라
// 여기서 지우지 않음(항목을 지워도 이미 올린 줄은 매입장에 그대로).

function revalidateAll() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const isDate = (v: string | null) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v);

function parse(formData: FormData): { row: Record<string, unknown> } | { error: string } {
  const name = text(formData.get("name"));
  if (!name) return { error: "이름을 입력해주세요." };
  const payDay = Number(formData.get("pay_day"));
  if (!Number.isInteger(payDay) || payDay < 1 || payDay > 31) return { error: "결제일은 1~31 사이 숫자로 입력해주세요(그 달에 없는 날은 말일)." };
  const amount = Number(String(formData.get("amount") ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount === 0) return { error: "금액을 입력해주세요(매달 다르면 예상 금액)." };
  const startDate = text(formData.get("start_date"));
  const endDate = text(formData.get("end_date"));
  if (!isDate(startDate) || !isDate(endDate)) return { error: "날짜 형식이 올바르지 않습니다." };
  if (startDate && endDate && endDate < startDate) return { error: "끝나는 날이 시작일보다 앞입니다." };
  return {
    row: {
      name,
      pay_day: payDay,
      client_id: text(formData.get("client_id")),
      client_name_raw: text(formData.get("client_name_raw")),
      item_name: text(formData.get("item_name")),
      amount,
      add_vat: formData.get("add_vat") === "on",
      tax_invoice_issued: formData.get("tax_invoice_issued") === "on",
      payment_method_id: text(formData.get("payment_method_id")),
      category_id: text(formData.get("category_id")),
      start_date: startDate,
      end_date: endDate,
      paused: formData.get("paused") === "on",
      memo: text(formData.get("memo")),
    },
  };
}

export async function createRecurringExpense(formData: FormData) {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 화면(CreatePanel idempotent)에서 정한 새 id — 연결이 끊겨 다시 보내도 같은 항목이 두 번 생기지 않게(lib/idempotentSave.ts)
  const newIds = validNewIds([formData.get(NEW_ID_FIELD)]);
  const row = { ...(newIds ? { id: newIds[0] } : {}), ...parsed.row, created_by: user?.id ?? null };
  const result = await insertOnce(
    newIds,
    () => supabase.from("recurring_expenses").insert(row),
    (ids) => countSavedIds(supabase, "recurring_expenses", ids)
  );
  if (result.error) return { error: result.error };
  revalidateAll();
}

export async function updateRecurringExpense(formData: FormData) {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_expenses")
    .update({ ...parsed.row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "고정지출 항목을 찾지 못했거나 수정할 권한이 없습니다." };
  revalidateAll();
}

export async function deleteRecurringExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_expenses").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "고정지출 항목을 찾지 못했거나 삭제할 권한이 없습니다." };
  revalidateAll();
}

/** "지금 올리기" — 올릴 차례인 것을 바로 올림(매일 아침 서버가 하는 것과 같은 일). */
export async function postRecurringExpensesNow(): Promise<{ error?: string; posted?: number; message?: string }> {
  const role = await getCurrentRole();
  if (role !== "admin" && role !== "staff") return { error: "관리자·직원만 올릴 수 있습니다." };
  const supabase = await createClient();
  let result;
  try {
    result = await postDueRecurring(supabase, nowKstParts().date);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "고정지출을 올리지 못했습니다." };
  }
  if (result.missing) return { error: "108 SQL을 먼저 실행해야 합니다." };
  if (result.posted.length) revalidateAll();
  if (result.failed.length) {
    const first = result.failed[0];
    return {
      posted: result.posted.length,
      error: `${result.posted.length ? `${result.posted.length}건은 올렸지만 ` : ""}${result.failed.length}건을 올리지 못했습니다(${first.name} ${first.date}: ${first.error}).`,
    };
  }
  return {
    posted: result.posted.length,
    message: result.posted.length ? `${result.posted.length}건을 매입장에 "분류 대기"로 올렸습니다.` : "지금 올릴 항목이 없습니다.",
  };
}
