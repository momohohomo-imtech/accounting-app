export const QUOTE_STATUS_OPTIONS = [
  { value: "draft", label: "작성중" },
  { value: "sent", label: "발송완료", color: "blue" as const },
  { value: "accepted", label: "수주확정", color: "red" as const },
  { value: "rejected", label: "반려/보류" },
];

export function quoteStatusLabel(status: string | null | undefined) {
  return QUOTE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? "-";
}
