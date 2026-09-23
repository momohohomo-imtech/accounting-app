// 결제수단 이름에 지정하는 글씨색·배경색 — 고정 5색 중 택1, 두 선택이 같은
// 팔레트를 공유함(공구 색상 팔레트 toolColors.ts와 같은 5색).
export const PAYMENT_METHOD_COLORS = [
  { label: "빨강", hex: "#ef4444" },
  { label: "파랑", hex: "#0ea5e9" },
  { label: "초록", hex: "#22c55e" },
  { label: "주황", hex: "#f59e0b" },
  { label: "백색", hex: "#ffffff" },
] as const;

// 결제수단 이름이 뱃지/드롭다운 옵션으로 나오는 모든 곳(거래 등록 폼, 매입처별 집계,
// 현장 내역서, 매입매출 목록 등)에서 공용으로 쓰는 색 스타일.
export function paymentMethodColorStyle(pm?: { text_color?: string | null; background_color?: string | null } | null) {
  return { color: pm?.text_color ?? undefined, backgroundColor: pm?.background_color ?? undefined };
}
