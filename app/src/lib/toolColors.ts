// 공구 마스터 목록/공구명세서에서 공구별로 지정하는 글씨색·배경색 — 고정 6색 중 택1,
// 두 선택이 같은 팔레트를 공유함(예: 배경색을 진하게 넣고 글씨색을 백색으로 조합).
export const TOOL_COLORS = [
  { label: "빨강", hex: "#ef4444" },
  { label: "파랑", hex: "#0ea5e9" },
  { label: "초록", hex: "#22c55e" },
  { label: "주황", hex: "#f59e0b" },
  { label: "보라", hex: "#a855f7" },
  { label: "백색", hex: "#ffffff" },
] as const;
