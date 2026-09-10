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
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { BankTransactionFilter } from "@/components/BankTransactionFilter";

const accountFields: FieldConfig[] = [
  { name: "bank_name", label: "은행명", required: true },
  { name: "nickname", label: "별칭" },
  { name: "account_number", label: "계좌번호" },
  { name: "opening_balance", label: "시작 잔액", type: "number", format: "won" },
  { name: "sort_order", label: "정렬순서", type: "number" },
];

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string; month?: string; direction?: string }>;
}) {
  const { year, quarter, month, direction } = await searchParams;
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;
  const selectedQuarter = quarter ?? "";
  const selectedMonth = month ?? "";
  const selectedDirection = direction ?? "";

  const pad = (n: number) => String(n).padStart(2, "0");
  let rangeStart = `${selectedYear}-01-01`;
  let rangeEnd = `${selectedYear}-12-31`;
  if (selectedMonth) {
    const m = Number(selectedMonth);
    const lastDay = new Date(selectedYear, m, 0).getDate();
    rangeStart = `${selectedYear}-${pad(m)}-01`;
    rangeEnd = `${selectedYear}-${pad(m)}-${pad(lastDay)}`;
  } else if (selectedQuarter) {
    const q = Number(selectedQuarter);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(selectedYear, endMonth, 0).getDate();
    rangeStart = `${selectedYear}-${pad(startMonth)}-01`;
    rangeEnd = `${selectedYear}-${pad(endMonth)}-${pad(lastDay)}`;
  }

  let transactionsQuery = supabase
    .from("bank_transactions")
    .select("*, bank_accounts(nickname, bank_name), clients(name)")
    .gte("trans_date", rangeStart)
    .lte("trans_date", rangeEnd)
    .order("trans_date", { ascending: false });
  if (selectedDirection) transactionsQuery = transactionsQuery.eq("direction", selectedDirection);

  const [{ data: accounts }, { data: clients }, { data: transactions }, { data: allTx }, { data: firstTx }] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
    transactionsQuery,
    supabase.from("bank_transactions").select("bank_account_id, direction, amount"),
    supabase.from("bank_transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
  ]);

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  const balanceByAccount = new Map<string, number>();
  for (const a of accounts ?? []) balanceByAccount.set(a.id, a.opening_balance ?? 0);
  for (const t of allTx ?? []) {
    const delta = t.direction === "입금" ? t.amount : -t.amount;
    balanceByAccount.set(t.bank_account_id, (balanceByAccount.get(t.bank_account_id) ?? 0) + delta);
  }
  const totalBalance = Array.from(balanceByAccount.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-slate-900">은행 계좌 / 거래내역</h1>
        <p className="text-sm text-slate-500">
          총 잔액 합계{" "}
          <span className={`font-mono text-base font-bold ${totalBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
            {formatWon(totalBalance)}
          </span>
        </p>
      </div>

      {(accounts ?? []).length > 0 && (
        <div className="flex flex-wrap gap-4">
          {(accounts ?? []).map((a) => {
            const balance = balanceByAccount.get(a.id) ?? 0;
            return (
              <div key={a.id} className="min-w-[180px] flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">{a.nickname ?? a.bank_name}</p>
                <p className={`mt-2 font-mono text-2xl font-bold ${balance < 0 ? "text-red-600" : "text-slate-900"}`}>
                  {formatWon(balance)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <CreatePanel title="은행 계좌" fields={accountFields} createAction={createBankAccountRecord} />

      <CollapsibleSection title="계좌 목록" defaultOpen={false}>
        <EntityTable
          fields={accountFields}
          rows={accounts ?? []}
          updateAction={updateBankAccountRecord}
          deleteAction={deleteBankAccountRecord}
        />
      </CollapsibleSection>

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
            <label className="text-xs font-medium text-slate-500">매칭 거래처 (등록됨)</label>
            <select name="matched_client_id" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">선택 안함</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">매칭 거래처 (자유 입력)</label>
            <input
              name="matched_client_name_raw"
              placeholder="등록 안 된 거래처는 직접 입력"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              등록
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">거래내역</h2>
          <BankTransactionFilter
            years={years}
            selectedYear={selectedYear}
            selectedQuarter={selectedQuarter}
            selectedMonth={selectedMonth}
            selectedDirection={selectedDirection}
          />
        </div>

        <div className="mt-3 overflow-x-auto">
          <BankTransactionTable
            transactions={transactions ?? []}
            accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.nickname ?? a.bank_name }))}
            clients={clients ?? []}
          />
        </div>
      </div>
    </div>
  );
}
