"use client";

import { useState, type FormEvent } from "react";
import { createBankTransactionsBulk } from "@/lib/actions/bank";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";

const inputClass = "shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm";
const CLIENT_NAMES_DATALIST_ID = "bank-transaction-client-names";

type Row = {
  bank_account_id: string;
  direction: "입금" | "출금";
  amount: string;
  description: string;
  matched_client_name_raw: string;
  matched_client_id: string;
};

function emptyRow(defaultAccountId: string): Row {
  return {
    bank_account_id: defaultAccountId,
    direction: "입금",
    amount: "",
    description: "",
    matched_client_name_raw: "",
    matched_client_id: "",
  };
}

export function BankTransactionForm({
  accounts,
  clients,
  nameSuggestions,
}: {
  accounts: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  nameSuggestions: string[];
}) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const today = new Date().toISOString().slice(0, 10);
  const [transDate, setTransDate] = useState(today);
  const [rows, setRows] = useState<Row[]>([emptyRow(accounts[0]?.id ?? "")]);
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(accounts[0]?.id ?? "")]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rows.length === 0) return;
    if (!(await confirm(`${rows.length}건의 거래내역을 등록하시겠습니까?`))) return;

    const payload = rows.map((r) => ({
      bank_account_id: r.bank_account_id,
      direction: r.direction,
      amount: Number(r.amount) || 0,
      description: r.description.trim() || null,
      matched_client_id: r.matched_client_id || null,
      matched_client_name_raw: r.matched_client_id ? null : r.matched_client_name_raw.trim() || null,
    }));

    const fd = new FormData();
    fd.append("trans_date", transDate);
    fd.append("rows_json", JSON.stringify(payload));

    const result = await pending.run(() => createBankTransactionsBulk(fd));
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setRows([emptyRow(accounts[0]?.id ?? "")]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">거래내역 등록</h2>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          + 추가 거래등록
        </button>
      </div>
      <p className="text-xs text-slate-400">※ 추가 거래등록으로 늘어난 줄은 아래 날짜 하나를 모두 같이 씁니다 — 같은 날짜끼리만 한 번에 등록할 수 있어요.</p>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">날짜</label>
        <input
          type="date"
          value={transDate}
          onChange={(e) => setTransDate(e.target.value)}
          required
          className={`${inputClass} max-w-xs`}
        />
      </div>

      <datalist id={CLIENT_NAMES_DATALIST_ID}>
        {nameSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="space-y-2 overflow-x-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-nowrap items-center gap-2 rounded-lg border border-slate-100 p-3">
            <select
              value={r.bank_account_id}
              onChange={(e) => updateRow(i, { bank_account_id: e.target.value })}
              required
              className={`${inputClass} w-28`}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={r.direction}
              onChange={(e) => updateRow(i, { direction: e.target.value as "입금" | "출금" })}
              className={`${inputClass} w-20`}
            >
              <option value="입금">입금</option>
              <option value="출금">출금</option>
            </select>
            <input
              value={r.description}
              onChange={(e) => updateRow(i, { description: e.target.value })}
              placeholder="내용"
              className={`${inputClass} w-32`}
            />
            <input
              type="number"
              value={r.amount}
              onChange={(e) => updateRow(i, { amount: e.target.value })}
              placeholder="금액"
              required
              className={`${inputClass} w-28`}
            />
            <input
              value={r.matched_client_name_raw}
              onChange={(e) => updateRow(i, { matched_client_name_raw: e.target.value })}
              list={CLIENT_NAMES_DATALIST_ID}
              placeholder="거래처 수기 작성"
              className={`${inputClass} w-32`}
            />
            <select
              value={r.matched_client_id}
              onChange={(e) => updateRow(i, { matched_client_id: e.target.value })}
              className={`${inputClass} w-32`}
            >
              <option value="">선택 안함</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="shrink-0 text-xs text-red-500 hover:text-red-700"
              >
                이 줄 삭제
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        {rows.length > 1 ? `${rows.length}건 등록` : "등록"}
      </button>
    </form>
  );
}
