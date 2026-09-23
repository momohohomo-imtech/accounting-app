"use client";

import { useMemo, useState } from "react";
import {
  updateBankTransactionRecord,
  deleteBankTransactionRecord,
  promoteBankTransactionToLedger,
  unpromoteBankTransactionFromLedger,
} from "@/lib/actions/bank";
import { formatWon, formatDate } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { MatchedClientField } from "@/components/MatchedClientField";

type BankTxRow = {
  id: string;
  bank_account_id: string;
  trans_date: string;
  direction: string;
  description: string | null;
  amount: number;
  matched_client_id: string | null;
  matched_client_name_raw: string | null;
  transfer_group_id: string | null;
  promoted_transaction_id: string | null;
  bank_accounts?: { nickname: string | null; bank_name: string } | null;
  clients?: { name: string } | null;
};

type Option = { id: string; name: string };

type SortKey = "trans_date" | "account" | "direction" | "description" | "client" | "amount";

function sortValue(t: BankTxRow, key: SortKey): string | number {
  switch (key) {
    case "trans_date":
      return t.trans_date;
    case "account":
      return t.bank_accounts?.nickname ?? t.bank_accounts?.bank_name ?? "";
    case "direction":
      return t.direction;
    case "description":
      return t.description ?? "";
    case "client":
      return t.clients?.name ?? t.matched_client_name_raw ?? "";
    case "amount":
      return t.amount;
  }
}

const inputClass = "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm";

export function BankTransactionTable({
  transactions,
  accounts,
  clients,
  nameSuggestions,
}: {
  transactions: BankTxRow[];
  accounts: Option[];
  clients: Option[];
  nameSuggestions: string[];
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-slate-800">
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    );
  }

  const sorted = useMemo(() => {
    if (!sortKey) return transactions;
    const copy = [...transactions];
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(await confirm("수정 내용을 저장하시겠습니까?"))) return;
    setActionError(null);
    const result = await pending.run(() => Promise.resolve(updateBankTransactionRecord(new FormData(form))));
    if (result?.error) {
      setActionError(result.error);
      return;
    }
    setEditingId(null);
  }

  async function handleConfirmDelete(id: string) {
    if (!(await confirm("이 거래내역을 삭제하시겠습니까?", { danger: true, confirmLabel: "삭제" }))) return;
    setActionError(null);
    const fd = new FormData();
    fd.append("id", id);
    const result = await pending.run(() => Promise.resolve(deleteBankTransactionRecord(fd)));
    if (result?.error) setActionError(result.error);
  }

  async function handleTogglePromote(id: string, checked: boolean) {
    if (!checked) {
      // 체크 해제 = 매입/매출장에 자동 등록됐던 내용이 삭제됨(아직 손대지 않은 경우만 — 이미
      // 분류/수정한 건은 서버가 거부하고 안내). 되돌릴 수 없어서 두 번 확인받는다.
      if (
        !(await confirm(
          "이 체크를 해제하면 매입/매출장에 자동으로 올라갔던 내역이 삭제됩니다. (매입/매출장에서 이미 분류하거나 수정한 내역이면 삭제되지 않고 안내가 표시됩니다.) 계속할까요?",
          { danger: true, confirmLabel: "계속" }
        ))
      )
        return;
      if (
        !(await confirm("마지막 확인입니다 — 삭제하면 되돌릴 수 없습니다. 정말 삭제하시겠습니까?", {
          danger: true,
          confirmLabel: "삭제",
        }))
      )
        return;
    }

    setActionError(null);
    const fd = new FormData();
    fd.append("id", id);
    const result = await pending.run(() =>
      Promise.resolve(checked ? promoteBankTransactionToLedger(fd) : unpromoteBankTransactionFromLedger(fd))
    );
    if (result?.error) setActionError(result.error);
  }

  return (
    <>
    {actionError && <p className="mb-2 text-sm text-red-600">{actionError}</p>}
    <table className="sticky-col-table w-full min-w-[700px] text-sm">
      <thead>
        <tr className="whitespace-nowrap border-b border-slate-200 text-left text-slate-500">
          <th className="pb-2 pr-4">{headerButton("trans_date", "날짜")}</th>
          <th className="pb-2 pr-4">{headerButton("account", "계좌")}</th>
          <th className="pb-2 pr-4">{headerButton("direction", "구분")}</th>
          <th className="sticky-col pb-2 pr-4">{headerButton("description", "내용")}</th>
          <th className="pb-2 pr-4">{headerButton("client", "매칭 거래처")}</th>
          <th className="pb-2 pr-4 text-right">{headerButton("amount", "금액")}</th>
          <th className="pb-2 pr-4 text-center">매입/매출장</th>
          <th className="pb-2 text-right">관리</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) =>
          editingId === t.id ? (
            <tr key={t.id} className="border-b border-slate-100 bg-slate-50 last:border-0">
              <td colSpan={8} className="py-3 pr-4">
                <form onSubmit={handleSaveEdit} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
                  <input type="hidden" name="id" value={t.id} />
                  <select name="bank_account_id" required defaultValue={t.bank_account_id} className={inputClass}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {t.promoted_transaction_id ? (
                    <>
                      <input type="hidden" name="trans_date" value={t.trans_date} />
                      <input type="hidden" name="direction" value={t.direction} />
                      <input type="hidden" name="amount" value={t.amount} />
                      <input type="date" value={t.trans_date} disabled className={`${inputClass} bg-slate-100`} />
                      <input value={t.direction} disabled className={`${inputClass} bg-slate-100`} />
                      <input value={formatWon(t.amount)} disabled className={`${inputClass} bg-slate-100`} />
                    </>
                  ) : (
                    <>
                      <input type="date" name="trans_date" required defaultValue={t.trans_date} className={inputClass} />
                      {t.transfer_group_id ? (
                        <>
                          <input type="hidden" name="direction" value={t.direction} />
                          <input value={t.direction} disabled className={`${inputClass} bg-slate-100`} />
                        </>
                      ) : (
                        <select name="direction" defaultValue={t.direction} className={inputClass}>
                          <option value="입금">입금</option>
                          <option value="출금">출금</option>
                        </select>
                      )}
                      <input type="number" name="amount" required defaultValue={t.amount} className={inputClass} />
                    </>
                  )}
                  <input name="description" defaultValue={t.description ?? ""} placeholder="내용" className={inputClass} />
                  <MatchedClientField
                    clients={clients}
                    nameSuggestions={nameSuggestions}
                    defaultClientId={t.matched_client_id}
                    defaultNameRaw={t.matched_client_name_raw}
                    selectClassName={inputClass}
                    inputClassName={inputClass}
                  />
                  {(t.promoted_transaction_id || t.transfer_group_id) && (
                    <p className="text-xs text-slate-500 lg:col-span-7">
                      {t.promoted_transaction_id
                        ? "매입/매출장에 등록된 거래라 날짜·입출금·금액은 바꿀 수 없습니다. 매입/매출장에서 수정하거나 등록을 취소한 뒤 수정해주세요."
                        : "계좌 간 이체 — 날짜·금액·내용을 바꾸면 반대쪽 계좌의 짝에도 똑같이 반영됩니다."}
                    </p>
                  )}
                  <div className="flex gap-2 lg:col-span-7">
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </td>
            </tr>
          ) : (
            <tr key={t.id} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap py-2 pr-4 text-slate-600" title={formatDate(t.trans_date)}>
                {/* 화면은 연도 필터로 이미 한 해만 보이므로 월-일만, 인쇄는 전체 날짜 */}
                <span className="print:hidden">{formatDate(t.trans_date).slice(5)}</span>
                <span className="hidden print:inline">{formatDate(t.trans_date)}</span>
              </td>
              <td className="whitespace-nowrap py-2 pr-4 text-slate-700">{t.bank_accounts?.nickname ?? t.bank_accounts?.bank_name}</td>
              <td className="whitespace-nowrap py-2 pr-4">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.direction === "입금" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                  }`}
                >
                  {t.direction}
                </span>
                {t.transfer_group_id && (
                  <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">이체</span>
                )}
              </td>
              <td className="sticky-col py-2 pr-4 text-slate-700 max-md:max-w-[9rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal" title={t.description ?? undefined}>
                {t.description ?? "-"}
              </td>
              <td
                className="py-2 pr-4 text-slate-700 max-md:max-w-[8rem] max-md:truncate print:max-w-none print:overflow-visible print:whitespace-normal"
                title={t.clients?.name ?? t.matched_client_name_raw ?? undefined}
              >
                {t.clients?.name ?? t.matched_client_name_raw ?? "-"}
              </td>
              <td className="whitespace-nowrap py-2 pr-4 text-right font-medium text-slate-900">{formatWon(t.amount)}</td>
              <td className="whitespace-nowrap py-2 pr-4 text-center">
                {t.transfer_group_id ? (
                  <span className="text-xs text-slate-300" title="계좌 간 이체 내역은 올릴 수 없습니다">
                    -
                  </span>
                ) : t.promoted_transaction_id ? (
                  <button
                    type="button"
                    onClick={() => handleTogglePromote(t.id, false)}
                    className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-red-50 hover:text-red-600"
                    title="눌러서 매입/매출장 등록을 취소합니다 (등록됐던 내역이 삭제됩니다)"
                  >
                    등록됨
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTogglePromote(t.id, true)}
                    className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    title="눌러서 매입/매출장에 분류 대기 중으로 자동 등록합니다"
                  >
                    등록
                  </button>
                )}
              </td>
              <td className="whitespace-nowrap py-2 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(t.id)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </td>
            </tr>
          )
        )}
        {sorted.length === 0 && (
          <tr>
            <td colSpan={8} className="py-6 text-center text-slate-400">
              거래내역이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
    </>
  );
}
