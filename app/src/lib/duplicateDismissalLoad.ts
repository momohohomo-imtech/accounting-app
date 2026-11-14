import type { SupabaseClient } from "@supabase/supabase-js";

// 장부 점검 "중복 의심" 숨긴 묶음 불러오기(106 SQL duplicate_dismissals) — 표가 없으면(실행 전) ready=false라 "숨기기" 버튼을 감추고
// 묶음은 예전처럼 다 보임. 다른 오류는 error로(숨긴 것도 다 보이게 두고 안내). 줄이 1,000개를 넘어도 끝까지.
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);
const PAGE_SIZE = 1000;

export type DuplicateDismissalLoad = { ready: boolean; keys: Set<string>; error: string | null };

export async function loadDuplicateDismissals(supabase: SupabaseClient): Promise<DuplicateDismissalLoad> {
  const keys = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("duplicate_dismissals")
      .select("id, dup_key")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (MISSING_TABLE.has(error.code ?? "")) return { ready: false, keys: new Set(), error: null };
      return { ready: true, keys: new Set(), error: error.message };
    }
    for (const r of (data ?? []) as { dup_key: string }[]) keys.add(r.dup_key);
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return { ready: true, keys, error: null };
}
