"use client";

import { useState } from "react";
import { settleCreditTransactions, deleteTransactionRecord } from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { fieldClass, labelClass } from "@/components/ui/field";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groupTotal = items.reduce((s, i) => s + i.remaining, 0);
  const selectedTotal = items.filter((i) => selected.has(i.tx.id)).reduce((s, i) => s + i.remaining, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <span className="text-sm text-slate-500">
          미정산 합계 <span className="font-semibold text-slate-900">{formatWon(groupTotal)}</span>
        </span>
      </CardHeader>

      <ul className="divide-y divide-slate-100">
        {items.map(({ tx, remaining }) => (
          <li key={tx.id} className="flex items-center gap-3 py-2 text-sm">
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
            <span className="shrink-0 font-medium text-slate-900">{formatWon(remaining)}</span>
            <LinkButton href={`/transactions?tab=credit&editTx=${tx.id}`} variant="secondary" size="xs">
              수정
            </LinkButton>
            {confirmDeleteId === tx.id ? (
              <form action={deleteTransactionRecord} className="flex shrink-0 items-center gap-1">
                <input type="hidden" name="id" value={tx.id} />
                <span className="text-xs font-medium text-red-600">정말 삭제?</span>
                <Button
                  variant="danger"
                  size="xs"
                  type="submit"
                  onClick={(e) => {
                    if (!confirm("정말로 이 내역을 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.")) e.preventDefault();
                  }}
                >
                  확인
                </Button>
                <Button variant="secondary" size="xs" type="button" onClick={() => setConfirmDeleteId(null)}>
                  취소
                </Button>
              </form>
            ) : (
              <Button variant="danger" size="xs" type="button" onClick={() => setConfirmDeleteId(tx.id)}>
                삭제
              </Button>
            )}
          </li>
        ))}
      </ul>

      {selected.size > 0 && (
        <form
          action={settleCreditTransactions}
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"
        >
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="transaction_ids" value={id} />
          ))}

          <div className="flex flex-col gap-1">
            <label className={labelClass}>정산일</label>
            <input
              type="date"
              name="paid_date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>결제수단</label>
            <select name="payment_method_id" required className={fieldClass}>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
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
    </Card>
  );
}
