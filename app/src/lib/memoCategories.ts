// 메모장 구분 — 고정 목록(085 SQL의 check 제약과 같아야 함). 비어 있으면 "미분류".
export const MEMO_CATEGORIES = [
  { value: "회사", badge: "bg-brand-soft text-brand-dark" },
  { value: "프로젝트", badge: "bg-indigo-50 text-indigo-700" },
  { value: "제작", badge: "bg-amber-50 text-amber-800" },
  { value: "현장", badge: "bg-emerald-50 text-emerald-700" },
  { value: "기타", badge: "bg-slate-100 text-slate-600" },
] as const;

export const MEMO_UNCATEGORIZED = "미분류";

export function isMemoCategory(v: string): boolean {
  return MEMO_CATEGORIES.some((c) => c.value === v);
}

export function memoCategoryBadge(v: string | null | undefined) {
  return MEMO_CATEGORIES.find((c) => c.value === v)?.badge ?? "bg-slate-50 text-slate-400";
}
