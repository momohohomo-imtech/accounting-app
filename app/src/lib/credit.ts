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

// 거래별 "가장 마지막 정산 이력"(정산일 → 등록시각 순, 같으면 목록에서 뒤에 있는 것) 색인.
// 예전엔 거래 하나 볼 때마다 이력 전체를 걸러서 정렬했음(거래 수 × 이력 수). 같은 이력 배열에
// 대해서는 한 번만 만들어 재사용한다 — 이력 배열은 조회 후 수정하지 않는다는 전제(수정하면 새 배열로).
const latestPaymentCache = new WeakMap<CreditPayment[], Map<string, CreditPayment>>();

function latestPaymentByTx(payments: CreditPayment[]) {
  let index = latestPaymentCache.get(payments);
  if (!index) {
    index = new Map();
    for (const p of payments) {
      const prev = index.get(p.transaction_id);
      if (!prev || (p.paid_date.localeCompare(prev.paid_date) || p.created_at.localeCompare(prev.created_at)) >= 0) {
        index.set(p.transaction_id, p);
      }
    }
    latestPaymentCache.set(payments, index);
  }
  return index;
}

export function remainingBalance(tx: BalanceFields, payments: CreditPayment[]) {
  const latest = latestPaymentByTx(payments).get(tx.id);
  return latest ? latest.remaining_amount : transactionTotal(tx);
}

// 외상 건이 완납(정산 이력이 있고 잔액 0)됐는지 여부.
export function isCreditSettled(tx: BalanceFields, payments: CreditPayment[]) {
  const latest = latestPaymentByTx(payments).get(tx.id);
  return latest !== undefined && latest.remaining_amount === 0;
}

// 매입매출 장부(및 각종 합계)에 포함시켜야 하는 거래인지 여부.
// 외상은 완납 전까지 장부에서 빠지고(외상관리 탭에서만 보임), 완납되면 원본 거래 그대로 장부에 편입된다.
export function isLedgerVisible(tx: LedgerFields, payments: CreditPayment[]) {
  return tx.payment_type !== "credit" || isCreditSettled(tx, payments);
}
