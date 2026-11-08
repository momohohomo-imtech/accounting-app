import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MEMO_CATEGORIES, sortMemoCategories, type MemoCategory } from "@/lib/memoCategories";

// 메모장 구분 목록 불러오기(104 SQL memo_categories) — 표가 없으면(실행 전) 예전 고정 5개로 동작(ready=false, 구분 관리 칸 숨김).
// 다른 오류는 error로 알려 주고(목록을 못 불러옴) 기본 5개로 보여 줌.
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

export type MemoCategoryLoad = { categories: MemoCategory[]; ready: boolean; error: string | null };

export async function loadMemoCategories(supabase: SupabaseClient): Promise<MemoCategoryLoad> {
  const { data, error } = await supabase
    .from("memo_categories")
    .select("id, name, color, sort_order")
    .order("sort_order")
    .order("name");
  if (error) {
    return { categories: DEFAULT_MEMO_CATEGORIES, ready: false, error: MISSING_TABLE.has(error.code ?? "") ? null : error.message };
  }
  return { categories: sortMemoCategories((data ?? []) as MemoCategory[]), ready: true, error: null };
}
