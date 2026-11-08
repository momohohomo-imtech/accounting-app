// 메모장 구분(11/8 사용자 요청 "구분을 추가·수정할 수 있게") — 104 SQL부터 memo_categories 표(이름·색·순서)를 메모장 "구분 관리"에서
// 추가·이름/색·순서 바꾸기·삭제(메모가 남은 구분은 삭제 막음 — 사용자 결정). 메모에는 구분 이름(글자)이 그대로 저장되고, 이름을 바꾸면
// 그 구분의 메모도 같이 바뀜(DB 함수 rename_memo_category). 104 실행 전엔 예전 고정 5개(085 SQL 제약과 같음)로 동작.
// 목록에 없는 이름이 메모에 남아 있으면(예전 백업 복원 등) 그 이름도 탭으로 보여 줌 — 메모가 숨지 않게. 검사: memoCategories.test.ts
import type { RowBgColor } from "@/components/crud/types";

export type MemoCategory = { id: string | null; name: string; color: string; sort_order: number };

// 색 — 이름은 EntityTable 점 색(RowBgColor)과 같게. 배지는 메모 카드·구분 표에 씀(예전 5개 색 그대로: 회사 파랑·프로젝트 남색·제작 노랑·
// 현장 초록·기타 회색). 새 구분 추가 칸은 첫 색(회색)이 기본.
export const MEMO_CATEGORY_COLORS: { value: RowBgColor; label: string; badge: string }[] = [
  { value: "gray", label: "회색", badge: "bg-slate-100 text-slate-600" },
  { value: "blue", label: "파랑", badge: "bg-brand-soft text-brand-dark" },
  { value: "indigo", label: "남색", badge: "bg-indigo-50 text-indigo-700" },
  { value: "cyan", label: "하늘", badge: "bg-cyan-50 text-cyan-700" },
  { value: "teal", label: "청록", badge: "bg-teal-50 text-teal-700" },
  { value: "green", label: "초록", badge: "bg-emerald-50 text-emerald-700" },
  { value: "amber", label: "노랑", badge: "bg-amber-50 text-amber-800" },
  { value: "orange", label: "주황", badge: "bg-orange-50 text-orange-700" },
  { value: "red", label: "빨강", badge: "bg-red-50 text-red-700" },
  { value: "pink", label: "분홍", badge: "bg-pink-50 text-pink-700" },
  { value: "fuchsia", label: "자주", badge: "bg-fuchsia-50 text-fuchsia-700" },
  { value: "purple", label: "보라", badge: "bg-purple-50 text-purple-700" },
];

// 104 실행 전(표 없음) — 085 SQL 제약의 5개와 같은 이름·순서·색.
export const DEFAULT_MEMO_CATEGORIES: MemoCategory[] = [
  { id: null, name: "회사", color: "blue", sort_order: 0 },
  { id: null, name: "프로젝트", color: "indigo", sort_order: 1 },
  { id: null, name: "제작", color: "amber", sort_order: 2 },
  { id: null, name: "현장", color: "green", sort_order: 3 },
  { id: null, name: "기타", color: "gray", sort_order: 4 },
];

export const MEMO_UNCATEGORIZED = "미분류";
export const MEMO_CATEGORY_MAX_LENGTH = 20;
// 탭에 따로 쓰는 이름이라 구분 이름으로는 못 씀
const RESERVED_NAMES = [MEMO_UNCATEGORIZED, "전체"];
// 목록에 없는 구분·미분류 배지
const FAINT_BADGE = "bg-slate-50 text-slate-400";

/** 구분 이름 다듬기 — 앞뒤 공백 빼고 사이 공백은 한 칸 */
export function normalizeMemoCategoryName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s+/g, " ").trim();
}

/** 색 값 확인 — 목록에 없으면 회색 */
export function memoCategoryColor(value: string | null | undefined): RowBgColor {
  return MEMO_CATEGORY_COLORS.find((c) => c.value === value)?.value ?? "gray";
}

/** 구분 목록 순서 — 순서 칸, 같으면 이름(가나다) */
export function sortMemoCategories<T extends { name: string; sort_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ko"));
}

/** 메모 카드·표의 구분 배지 색(구분 이름으로) — 목록에 없는 구분·미분류는 옅은 회색 */
export function memoCategoryBadge(name: string | null | undefined, categories: MemoCategory[]): string {
  const category = name ? categories.find((c) => c.name === name) : undefined;
  if (!category) return FAINT_BADGE;
  return MEMO_CATEGORY_COLORS.find((c) => c.value === memoCategoryColor(category.color))?.badge ?? FAINT_BADGE;
}

/**
 * 메모장 탭 순서 — 구분 목록 순서대로, 그다음 목록에 없는데 메모에 남아 있는 이름(가나다), 맨 끝 "미분류".
 * (미분류 탭은 해당 메모가 있을 때만 보이게 부르는 쪽에서 거름)
 */
export function memoCategoryTabs(categories: MemoCategory[], memoCategoryNames: (string | null | undefined)[]): string[] {
  const listed = sortMemoCategories(categories).map((c) => c.name);
  const extra = Array.from(new Set(memoCategoryNames.filter((n): n is string => Boolean(n) && !listed.includes(n as string)))).sort(
    (a, b) => a.localeCompare(b, "ko")
  );
  return [...listed, ...extra, MEMO_UNCATEGORIZED];
}

/** 구분 이름 문제 — 비었거나 너무 길거나 탭 이름("미분류"·"전체")이거나 이미 있으면 안내 문구, 괜찮으면 null. selfId = 고치는 구분 */
export function memoCategoryNameProblem(name: string, categories: MemoCategory[], selfId: string | null = null): string | null {
  const n = normalizeMemoCategoryName(name);
  if (!n) return "구분 이름을 입력해주세요.";
  if (n.length > MEMO_CATEGORY_MAX_LENGTH) return `구분 이름은 ${MEMO_CATEGORY_MAX_LENGTH}자까지 쓸 수 있습니다.`;
  if (RESERVED_NAMES.includes(n)) return `'${n}'은(는) 구분 이름으로 쓸 수 없습니다.`;
  if (categories.some((c) => c.id !== selfId && normalizeMemoCategoryName(c.name) === n)) return `'${n}' 구분이 이미 있습니다.`;
  return null;
}

/** 새 구분 순서 — 비워 두면 맨 뒤(지금 가장 큰 순서 + 1) */
export function nextMemoCategorySortOrder(categories: { sort_order: number }[]): number {
  return categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
}
