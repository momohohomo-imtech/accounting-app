import type { CreditPayment } from "@/lib/types";

type BalanceFields = {
  id: string;
  type: string;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
};
type LedgerFields = BalanceFields & { payment_type: string };

export function transactionTotal(tx: Pick<BalanceFields, "type" | "sales_amount" | "sales_vat" | "purchase_amount" | "purchase_vat">) {
  return tx.type === "매출" ? tx.sales_amount + tx.sales_vat : tx.purchase_amount + tx.purchase_vat;
}

export function remainingBalance(tx: BalanceFields, payments: CreditPayment[]) {
  const txPayments = payments
    .filter((p) => p.transaction_id === tx.id)
    .sort((a, b) => a.paid_date.localeCompare(b.paid_date) || a.created_at.localeCompare(b.created_at));
  if (txPayments.length === 0) return transactionTotal(tx);
  return txPayments[txPayments.length - 1].remaining_amount;
}

// 외상 건이 완납(정산 이력이 있고 잔액 0)됐는지 여부.
export function isCreditSettled(tx: BalanceFields, payments: CreditPayment[]) {
  const hasPayment = payments.some((p) => p.transaction_id === tx.id);
  return hasPayment && remainingBalance(tx, payments) === 0;
}

// 매입매출 장부(및 각종 합계)에 포함시켜야 하는 거래인지 여부.
// 외상은 완납 전까지 장부에서 빠지고(외상관리 탭에서만 보임), 완납되면 원본 거래 그대로 장부에 편입된다.
export function isLedgerVisible(tx: LedgerFields, payments: CreditPayment[]) {
  return tx.payment_type !== "credit" || isCreditSettled(tx, payments);
}
