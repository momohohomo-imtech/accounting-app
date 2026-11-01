// 신고 끝난 해 잠금(097 SQL locked_years + 거래 트리거) — 잠근 해의 거래는 추가·삭제와 신고 칸(날짜·구분·거래처·카테고리·금액·
// 부가세·세금계산서·외상 여부) 수정을 DB가 막음. 프로젝트·결제수단·품목·메모·한 결제 묶기·외상 정산은 그대로. 잠그기·풀기는
// 관리자만(매입매출 → 장부 점검). 표가 없으면(097 실행 전) ready: false로 화면을 숨김.
export type LockedYear = { year: number; locked_at: string; memo: string | null };

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

export async function loadLockedYears(
  query: () => PromiseLike<{ data: LockedYear[] | null; error: { code?: string; message: string } | null }>
): Promise<{ ready: boolean; years: LockedYear[]; error: string | null }> {
  const { data, error } = await query();
  if (error) {
    if (MISSING_TABLE.has(error.code ?? "")) return { ready: false, years: [], error: null };
    return { ready: true, years: [], error: error.message };
  }
  return { ready: true, years: [...(data ?? [])].sort((a, b) => b.year - a.year), error: null };
}

export function isYearLocked(years: LockedYear[], year: number) {
  return years.some((y) => y.year === year);
}
