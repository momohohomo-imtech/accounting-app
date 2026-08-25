import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import {
  createBankAccountRecord,
  updateBankAccountRecord,
  deleteBankAccountRecord,
  createBankTransactionRecord,
  deleteBankTransactionRecord,
} from "@/lib/actions/bank";
import type { FieldConfig } from "@/components/crud/types";
import { formatWon, formatDate } from "@/lib/format";

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
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">날짜</th>
                <th className="pb-2 pr-4">계좌</th>
                <th className="pb-2 pr-4">구분</th>
                <th className="pb-2 pr-4">적요</th>
                <th className="pb-2 pr-4">매칭 거래처</th>
                <th className="pb-2 pr-4 text-right">금액</th>
                <th className="pb-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-600">{formatDate(t.trans_date)}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.bank_accounts?.nickname ?? t.bank_accounts?.bank_name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.direction === "입금" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{t.description ?? "-"}</td>
                  <td className="py-2 pr-4 text-slate-700">{t.clients?.name ?? "-"}</td>
                  <td className="py-2 pr-4 text-right font-medium text-slate-900">{formatWon(t.amount)}</td>
                  <td className="py-2 text-right">
                    <form action={deleteBankTransactionRecord}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(transactions ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    거래내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
