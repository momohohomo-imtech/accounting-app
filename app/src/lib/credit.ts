import type { CreditPayment, Transaction } from "@/lib/types";

export function transactionTotal(tx: Pick<Transaction, "type" | "sales_amount" | "sales_vat" | "purchase_amount" | "purchase_vat">) {
  return tx.type === "매출" ? tx.sales_amount + tx.sales_vat : tx.purchase_amount + tx.purchase_vat;
}

export function remainingBalance(tx: Transaction, payments: CreditPayment[]) {
  const txPayments = payments
    .filter((p) => p.transaction_id === tx.id)
    .sort((a, b) => a.paid_date.localeCompare(b.paid_date) || a.created_at.localeCompare(b.created_at));
  if (txPayments.length === 0) return transactionTotal(tx);
  return txPayments[txPayments.length - 1].remaining_amount;
}
