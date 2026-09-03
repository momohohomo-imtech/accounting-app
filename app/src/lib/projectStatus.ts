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

export function projectStatusLabel(status: string | null | undefined) {
  return PROJECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? "-";
}
