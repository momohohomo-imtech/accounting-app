"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chunkIds } from "@/lib/bulkUpdate";
import { normalizeWatchMemo } from "@/lib/transactionWatch";

// 매입매출 "챙길 거래" 창(105 SQL transaction_watch) 저장 — 올리기·빼기·줄 메모. 창에만 쓰는 표시라 거래(금액·날짜 등)는 안 바뀜.
// 조회 전용 계정은 DB가 막음(올리기는 권한 오류, 빼기·메모는 바뀐 줄 0 → 안내).

const NO_PERMISSION = "42501";
function message(error: { code?: string; message: string }) {
  return error.code === NO_PERMISSION ? "챙길 거래를 바꿀 권한이 없습니다(조회 전용 계정)." : error.message;
}

function idsOf(formData: FormData) {
  return Array.from(new Set(formData.getAll("transaction_ids").map(String).filter(Boolean)));
}

/** 올리기 — 이미 올라간 거래는 그대로(메모도 그대로) */
export async function watchTransactions(formData: FormData): Promise<{ error?: string }> {
  const ids = idsOf(formData);
  if (ids.length === 0) return { error: "올릴 거래가 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("transaction_watch")
    .upsert(
      ids.map((id) => ({ transaction_id: id })),
      { onConflict: "transaction_id", ignoreDuplicates: true }
    );
  if (error) return { error: message(error) };
  revalidatePath("/transactions");
  return {};
}

/** 빼기 — 창에서만 빠지고 거래는 그대로. 하나도 안 빠지면(권한 없음·이미 빠짐) 안내 */
export async function unwatchTransactions(formData: FormData): Promise<{ error?: string }> {
  const ids = idsOf(formData);
  if (ids.length === 0) return { error: "뺄 거래가 없습니다." };
  const supabase = await createClient();
  let removed = 0;
  // 목록이 요청 주소에 들어가서 100개씩(lib/bulkUpdate.ts)
  for (const chunk of chunkIds(ids)) {
    const { data, error } = await supabase.from("transaction_watch").delete().in("transaction_id", chunk).select("id");
    if (error) {
      if (removed > 0) revalidatePath("/transactions");
      return { error: message(error) };
    }
    removed += data?.length ?? 0;
  }
  if (removed === 0) return { error: "챙길 거래에서 빼지 못했습니다 — 바꿀 권한이 없거나 이미 빠진 거래입니다(화면을 새로 고쳐 확인해 주세요)." };
  revalidatePath("/transactions");
  return {};
}

/** 줄 메모 — 한 결제 묶음 줄이면 그 줄의 거래 모두에 같은 메모 */
export async function updateTransactionWatchMemo(formData: FormData): Promise<{ error?: string }> {
  const ids = idsOf(formData);
  if (ids.length === 0) return { error: "메모를 적을 거래가 없습니다." };
  const memo = normalizeWatchMemo(String(formData.get("memo") ?? ""));
  const supabase = await createClient();
  let changed = 0;
  for (const chunk of chunkIds(ids)) {
    const { data, error } = await supabase.from("transaction_watch").update({ memo }).in("transaction_id", chunk).select("id");
    if (error) return { error: message(error) };
    changed += data?.length ?? 0;
  }
  if (changed === 0) return { error: "메모를 저장하지 못했습니다 — 바꿀 권한이 없거나 창에서 빠진 거래입니다(화면을 새로 고쳐 확인해 주세요)." };
  revalidatePath("/transactions");
  return {};
}
