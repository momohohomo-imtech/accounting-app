export const PROJECT_STATUS_OPTIONS = [
  { value: "review", label: "검토중" },
  { value: "ongoing", label: "진행중" },
  { value: "done", label: "공사 완료", color: "green" as const },
  { value: "done_awaiting_payment", label: "완료 수금대기", color: "blue" as const },
  { value: "collected", label: "수금 완료", color: "red" as const },
  { value: "merged", label: "타 프로젝트 귀속" },
  { value: "etc", label: "기타" },
];

// 수금 완료 전(= 이 값이 아닌) 프로젝트 행을 목록에서 옅은 빨강 배경으로 강조하는 데 씀.
export const PROJECT_STATUS_COLLECTED = "collected";
// 완료 수금대기 상태는 목록에서 옅은 파랑 배경으로 별도 강조하는 데 씀.
export const PROJECT_STATUS_AWAITING_PAYMENT = "done_awaiting_payment";
// 검토중(아직 수주 전) — 발주액은 예상 매출·예상 이익 같은 합계 계산에 넣지 않음(사용자 요청, lib/projectProfit.ts).
export const PROJECT_STATUS_REVIEW = "review";
// 타 프로젝트 귀속 — 자기 상태가 없어 어미 프로젝트의 상태를 물려받음(목록 상태색·이익 예상 계산).
export const PROJECT_STATUS_MERGED = "merged";

export function projectStatusLabel(status: string | null | undefined) {
  return PROJECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? "-";
}
