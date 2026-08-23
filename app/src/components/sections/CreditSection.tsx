import { createClient } from "@/lib/supabase/server";
import { addCreditPaymentRecord } from "@/lib/actions/transactions";
import { formatWon, formatDate } from "@/lib/format";
import { remainingBalance, transactionTotal } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";

export async function CreditSection() {
  const supabase = await createClient();
  const [{ data: creditTx }, { data: payments }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, clients(name), projects(name)")
      .eq("payment_type", "credit")
      .order("trans_date", { ascending: false }),
    supabase.from("credit_payments").select("*").order("paid_date", { ascending: false }),
  ]);

  const txs = (creditTx ?? []) as Transaction[];
  const pays = (payments ?? []) as CreditPayment[];

  const rows = txs.map((t) => ({
    tx: t,
    total: transactionTotal(t),
    remaining: remainingBalance(t, pays),
    history: pays.filter((p) => p.transaction_id === t.id),
  }));

  const totalOutstanding = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">외상 관리</h2>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-xs text-slate-500">전체 외상 잔액</p>
          <p className="text-xl font-bold text-slate-900">{formatWon(totalOutstanding)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map(({ tx, total, remaining, history }) => (
          <div key={tx.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  {formatDate(tx.trans_date)} · {tx.type} · {tx.clients?.name ?? tx.client_name_raw ?? "-"} ·{" "}
                  {tx.projects?.name ?? "일반경비"}
                </p>
                <p className="mt-1 font-medium text-slate-900">{tx.item_name ?? "-"}</p>
                <div className="mt-2 flex gap-4 text-sm">
                  <span className="text-slate-500">
                    총액 <span className="font-medium text-slate-900">{formatWon(total)}</span>
                  </span>
                  <span className="text-slate-500">
                    잔액{" "}
                    <span className={`font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatWon(remaining)}
                    </span>
                  </span>
                </div>
              </div>

              {remaining > 0 && (
                <form action={addCreditPaymentRecord} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="transaction_id" value={tx.id} />
                  <input type="hidden" name="current_remaining" value={remaining} />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">결제일</label>
                    <input
                      type="date"
                      name="paid_date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">결제 금액</label>
                    <input
                      type="number"
                      name="paid_amount"
                      required
                      max={remaining}
                      className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">
                    입금 등록
                  </button>
                </form>
              )}
            </div>

            {history.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">결제 이력</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  {history
                    .slice()
                    .sort((a, b) => b.paid_date.localeCompare(a.paid_date))
                    .map((h) => (
                      <li key={h.id}>
                        {formatDate(h.paid_date)} · {formatWon(h.paid_amount)} 입금 · 잔액 {formatWon(h.remaining_amount)}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">외상 거래가 없습니다.</p>}
      </div>
    </div>
  );
}
