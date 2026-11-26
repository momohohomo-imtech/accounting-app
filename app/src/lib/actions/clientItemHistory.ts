"use server";

import { createClient } from "@/lib/supabase/server";
import { nowKst } from "@/lib/kstDate";
import { rawClientNameSince } from "@/lib/supabaseFetchAll";
import { clientItemSuggestions, type ClientItemRow, type ClientItemSuggestion } from "@/lib/clientItemHistory";

// 거래 등록 "품목" 칸의 고르기 목록 — 고른 거래처(등록된 거래처, 없으면 직접 입력한 이름 그대로)의 예전 품목만(11/26 사용자 요청).
// 조회만 하는 동작이라 처리 중 표시 없이 부름. 최근 3년(직접 입력 거래처명 자동완성과 같은 기간)·최근 500줄까지만 — 해마다 읽는 양이
// 끝없이 늘지 않게, 고르기 목록은 최근 품목이면 충분.
const HISTORY_ROWS = 500;

export async function loadClientItemHistory(input: {
  clientId?: string | null;
  clientName?: string | null;
}): Promise<{ items: ClientItemSuggestion[]; error?: string }> {
  const clientId = (input.clientId ?? "").trim();
  const clientName = (input.clientName ?? "").trim();
  if (!clientId && !clientName) return { items: [] };
  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("item_name, trans_date, created_at, unit_price")
    .not("item_name", "is", null)
    .gte("trans_date", rawClientNameSince(nowKst()))
    .order("trans_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(HISTORY_ROWS);
  q = clientId ? q.eq("client_id", clientId) : q.eq("client_name_raw", clientName);
  const { data, error } = await q;
  if (error) return { items: [], error: error.message };
  return { items: clientItemSuggestions((data ?? []) as ClientItemRow[]) };
}
