export const PROJECT_STATUS_OPTIONS = [
  { value: "review", label: "검토중" },
  { value: "ongoing", label: "진행중" },
  { value: "done", label: "완료", color: "red" as const },
  { value: "done_awaiting_payment", label: "완료 수금대기", color: "blue" as const },
  { value: "merged", label: "타 프로젝트 귀속" },
  { value: "etc", label: "기타" },
];

export function projectStatusLabel(status: string | null | undefined) {
  return PROJECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? "-";
}
