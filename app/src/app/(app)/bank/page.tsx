import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createBankAccountRecord,
  updateBankAccountRecord,
  deleteBankAccountRecord,
  createBankTransactionRecord,
} from "@/lib/actions/bank";
import type { FieldConfig } from "@/components/crud/types";
import { formatWon } from "@/lib/format";
import { BankTransactionTable } from "@/components/BankTransactionTable";

const accountFields: FieldConfig[] = [
  { name: "bank_name", label: "은행명", required: true },
  { name: "nickname", label: "별칭" },
  { name: "account_number", label: "계좌번호" },
  { name: "opening_balance", label: "시작 잔액", type: "number" },
];

export default async function BankPage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: clients }, { data: transactions }, { data: allTx }] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("bank_transactions")
      .select("*, bank_accounts(nickname, bank_name), clients(name)")
      .order("trans_date", { ascending: false })
      .limit(100),
    supabase.from("bank_transactions").select("bank_account_id, direction, amount"),
  ]);

  const balanceByAccount = new Map<string, number>();
  for (const a of accounts ?? []) balanceByAccount.set(a.id, a.opening_balance ?? 0);
  for (const t of allTx ?? []) {
    const delta = t.direction === "입금" ? t.amount : -t.amount;
    balanceByAccount.set(t.bank_account_id, (balanceByAccount.get(t.bank_account_id) ?? 0) + delta);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">은행 계좌 / 거래내역</h1>

      {(accounts ?? []).length > 0 && (
        <div className="flex flex-wrap gap-4">
          {(accounts ?? []).map((a) => (
            <div key={a.id} className="min-w-[180px] flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{a.nickname ?? a.bank_name}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatWon(balanceByAccount.get(a.id) ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      <CreatePanel title="은행 계좌" fields={accountFields} createAction={createBankAccountRecord} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">계좌 목록</h2>
        <EntityTable
          fields={accountFields}
          rows={accounts ?? []}
          updateAction={updateBankAccountRecord}
          deleteAction={deleteBankAccountRecord}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">거래내역 등록</h2>
        <form action={createBankTransactionRecord} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">계좌</label>
            <select name="bank_account_id" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname ?? a.bank_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">날짜</label>
            <input type="date" name="trans_date" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">구분</label>
            <select name="direction" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="입금">입금</option>
              <option value="출금">출금</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">금액</label>
            <input type="number" name="amount" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">적요</label>
            <input name="description" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">매칭 거래처</label>
            <select name="matched_client_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">선택 안함</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              등록
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <BankTransactionTable transactions={transactions ?? []} />
        </div>
      </div>
    </div>
  );
}
