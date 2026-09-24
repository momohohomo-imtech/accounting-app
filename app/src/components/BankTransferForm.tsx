"use client";

import { useState, type FormEvent } from "react";
import { createBankTransferRecord } from "@/lib/actions/bank";
import { useConfirm } from "@/components/ConfirmProvider";
import { useGlobalPending } from "@/components/GlobalPendingProvider";
import { todayString } from "@/lib/format";
import { MoneyInput } from "@/components/ui/MoneyInput";

const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function BankTransferForm({ accounts }: { accounts: { id: string; name: string }[] }) {
  const confirm = useConfirm();
  const pending = useGlobalPending();
  const today = todayString();
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [transDate, setTransDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const fromName = accounts.find((a) => a.id === fromId)?.name ?? "";
    const toName = accounts.find((a) => a.id === toId)?.name ?? "";
    if (!(await confirm(`${fromName} → ${toName}로 ${amount || 0}원을 이체 등록하시겠습니까?`))) return;

    const fd = new FormData();
    fd.append("from_account_id", fromId);
    fd.append("to_account_id", toId);
    fd.append("trans_date", transDate);
    fd.append("amount", amount);
    fd.append("description", description);

    const result = await pending.run(() => createBankTransferRecord(fd));
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setAmount("");
    setDescription("");
  }

  if (accounts.length < 2) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="font-semibold text-slate-900">계좌 간 이체</h2>
      <p className="text-xs text-slate-400">보내는 계좌는 자동으로 출금, 받는 계좌는 자동으로 입금 처리됩니다.</p>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">보내는 계좌</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} required className={`${inputClass} w-full`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">받는 계좌</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} required className={`${inputClass} w-full`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">날짜</label>
            <input
              type="date"
              value={transDate}
              onChange={(e) => setTransDate(e.target.value)}
              required
              className={`${inputClass} w-full`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">금액</label>
            <MoneyInput
              value={amount}
              onValueChange={setAmount}
              required
              className={`${inputClass} w-full`}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">내용</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} w-full`} />
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
        이체 등록
      </button>
    </form>
  );
}
