export const PURCHASE_ORDER_STATUS_OPTIONS = [
  { value: "draft", label: "작성중" },
  { value: "sent", label: "발송완료", color: "blue" as const },
  { value: "received", label: "입고완료", color: "red" as const },
  { value: "canceled", label: "취소" },
];

export function purchaseOrderStatusLabel(status: string | null | undefined) {
  return PURCHASE_ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status ?? "-";
}
