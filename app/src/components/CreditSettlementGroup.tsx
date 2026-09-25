"use client";

import { useState } from "react";
import { settleCreditTransactions, deleteTransactionRecord } from "@/lib/actions/transactions";
import { todayString, formatWon, formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { paymentMethodColorStyle } from "@/lib/paymentMethodColors";
import { supplyOf } from "@/lib/vatBasis";
import type { PaymentMethod, Transaction } from "@/lib/types";

export type OutstandingItem = { tx: Transaction; remaining: number };

export function CreditSettlementGroup({
  label,
  items,
  paymentMethods,
}: {
  label: string;
  items: OutstandingItem[];
  paymentMethods: PaymentMethod[];
}) {
  const pending = useGlobalPending();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  async function handleSettle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSettleError(null);
    const result = await pending.run(() => settleCreditTransactions(fd));
    if (result?.error) {
      setSettleError(result.error);
      // settled: 정산(credit_payments) 자체는 끝났고 결제수단·메모 기록만 일부 실패한 경우 —
      // 선택을 비우지 않으면 다음 제출 때 이미 정산된 거래id가 다시 섞여 들어간다.
      if (result.settled) setSelected(new Set());
      return;
    }
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groupTotal = items.reduce((s, i) => s + i.remaining, 0);
  const groupVatExcludedTotal = items.reduce((s, i) => s + supplyOf(i.tx), 0);
  const selectedTotal = items.filter((i) => selected.has(i.tx.id)).reduce((s, i) => s + i.remaining, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <span className="text-sm text-slate-500">
          미정산 합계{" "}
          <span className="font-medium text-brand">VAT 제외 {formatWon(groupVatExcludedTotal)}</span>{" "}
          <span className="font-semibold text-slate-900">{formatWon(groupTotal)}</span>
        </span>
      </CardHeader>

      <ul className="divide-y divide-slate-100">
        {items.map(({ tx, remaining }) => (
          // flex-wrap: 휴대폰에선 한 줄에 다 안 들어가 금액·수정·삭제가 화면 밖으로 잘렸음 — 넘치면 둘째 줄 오른쪽으로.
          // PC·인쇄 폭에선 한 줄에 다 들어가서 예전과 같음.
          <li key={tx.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(tx.id)}
              onChange={() => toggle(tx.id)}
              className="h-4 w-4 accent-slate-900"
            />
            <span className="w-24 shrink-0 text-slate-500">{formatDate(tx.trans_date)}</span>
            <span className="w-28 shrink-0 truncate text-slate-500">
              {tx.needs_classification ? (
                <span className="inline-flex rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                  분류 대기 중
                </span>
              ) : (
                (tx.projects?.name ?? <span className="font-medium text-red-600">일반경비</span>)
              )}
            </span>
            <span className="flex-1 truncate text-slate-700">{tx.item_name ?? "-"}</span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              <span className="shrink-0 text-brand">
                {formatWon(supplyOf(tx))}
              </span>
              <span className="shrink-0 font-medium text-slate-900">{formatWon(remaining)}</span>
              <LinkButton href={`/transactions?tab=credit&editTx=${tx.id}`} variant="secondary" size="xs">
                수정
              </LinkButton>
              {confirmDeleteId === tx.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                  <Button
                    variant="danger"
                    size="xs"
                    type="button"
                    onClick={async () => {
                      const fd = new FormData();
                      fd.append("id", tx.id);
                      const result = await pending.run(() => deleteTransactionRecord(fd));
                      if (result?.error) {
                        setDeleteError(result.error);
                        return;
                      }
                      setDeleteError(null);
                      setConfirmDeleteId(null);
                    }}
                  >
                    확인
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setDeleteError(null);
                    }}
                  >
                    취소
                  </Button>
                  {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
                </div>
              ) : (
                <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(tx.id)}>
                  삭제
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {selected.size > 0 && (
        <form onSubmit={handleSettle} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="transaction_ids" value={id} />
          ))}

          <div className="flex flex-col gap-1">
            <label className={labelClass}>정산일</label>
            <input
              type="date"
              name="paid_date"
              required
              defaultValue={todayString()}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>결제수단</label>
            <select name="payment_method_id" required className={fieldClass}>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id} style={paymentMethodColorStyle(pm)}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">
            정산 등록 ({selected.size}건 · {formatWon(selectedTotal)})
          </Button>
        </form>
      )}
      {settleError && <p className="mt-2 text-sm text-red-600">{settleError}</p>}
    </Card>
  );
}
