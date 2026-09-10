import { createClient } from "@/lib/supabase/server";
import {
  createBankAccountRecord,
  updateBankAccountRecord,
  deleteBankAccountRecord,
} from "@/lib/actions/bank";
import type { FieldConfig } from "@/components/crud/types";
import { formatWon } from "@/lib/format";
import { BankTransactionTable } from "@/components/BankTransactionTable";
import { BankTransactionFilter } from "@/components/BankTransactionFilter";
import { BankAccountsPopup } from "@/components/BankAccountsPopup";
import { BankEntryPopup } from "@/components/BankEntryPopup";

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
  searchParams: Promise<{
    year?: string;
    period?: string;
    deposit?: string;
    withdrawal?: string;
    excludeAccounts?: string;
  }>;
}) {
  const { year, period, deposit, withdrawal, excludeAccounts } = await searchParams;
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const selectedYear = year ? Number(year) : currentYear;
  // period 파라미터가 아예 없으면(맨 처음 들어왔을 때) 이번 달을 기본값으로 —
  // "전체 기간"을 직접 고른 경우엔 "all"이 명시적으로 붙어있어서 이 기본값과 구분된다.
  const selectedPeriod = period ?? String(currentMonth);
  const showDeposit = deposit !== "0";
  const showWithdrawal = withdrawal !== "0";
  const excludedAccountIds = excludeAccounts ? excludeAccounts.split(",").filter(Boolean) : [];

  const pad = (n: number) => String(n).padStart(2, "0");
  let rangeStart = `${selectedYear}-01-01`;
  let rangeEnd = `${selectedYear}-12-31`;
  if (selectedPeriod.startsWith("q")) {
    const q = Number(selectedPeriod.slice(1));
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(selectedYear, endMonth, 0).getDate();
    rangeStart = `${selectedYear}-${pad(startMonth)}-01`;
    rangeEnd = `${selectedYear}-${pad(endMonth)}-${pad(lastDay)}`;
  } else if (selectedPeriod && selectedPeriod !== "all") {
    const m = Number(selectedPeriod);
    const lastDay = new Date(selectedYear, m, 0).getDate();
    rangeStart = `${selectedYear}-${pad(m)}-01`;
    rangeEnd = `${selectedYear}-${pad(m)}-${pad(lastDay)}`;
  }

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  const excludedSet = new Set(excludedAccountIds);
  const includedAccountIds = (accounts ?? []).filter((a) => !excludedSet.has(a.id)).map((a) => a.id);

  let transactionsQuery = supabase
    .from("bank_transactions")
    .select("*, bank_accounts(nickname, bank_name), clients(name)")
    .gte("trans_date", rangeStart)
    .lte("trans_date", rangeEnd)
    .order("trans_date", { ascending: false });
  // 둘 다 체크(전체) 또는 둘 다 해제(빈 결과 방지)면 필터 안 걸고, 하나만 체크됐을 때만 그 방향으로 좁힌다.
  if (showDeposit !== showWithdrawal) transactionsQuery = transactionsQuery.eq("direction", showDeposit ? "입금" : "출금");
  if (excludedSet.size > 0) transactionsQuery = transactionsQuery.in("bank_account_id", includedAccountIds);

  const [{ data: clients }, { data: transactions }, { data: allTx }, { data: firstTx }, { data: rawNames }] =
    await Promise.all([
      supabase.from("clients").select("id, name").order("name"),
      transactionsQuery,
      supabase.from("bank_transactions").select("bank_account_id, direction, amount"),
      supabase.from("bank_transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
      supabase.from("bank_transactions").select("matched_client_name_raw").not("matched_client_name_raw", "is", null),
    ]);

  // 자동완성 목록 = 등록된 거래처 이름 + 예전에 수기로 직접 입력했던 이름들(등록 안 된 것 포함).
  const nameSuggestions = Array.from(
    new Set([
      ...(clients ?? []).map((c) => c.name),
      ...(rawNames ?? []).map((r) => r.matched_client_name_raw).filter((n): n is string => Boolean(n)),
    ])
  ).sort((a, b) => a.localeCompare(b));

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold text-slate-900">은행 계좌 / 거래내역</h1>
          <p className="text-sm text-slate-500">
            총 잔액 합계{" "}
            <span className={`font-mono text-base font-bold ${totalBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
              {formatWon(totalBalance)}
            </span>
          </p>
        </div>
        <BankAccountsPopup
          fields={accountFields}
          accounts={accounts ?? []}
          createAction={createBankAccountRecord}
          updateAction={updateBankAccountRecord}
          deleteAction={deleteBankAccountRecord}
        />
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">거래내역</h2>
          <div className="flex flex-wrap items-center gap-2">
            <BankTransactionFilter
              years={years}
              selectedYear={selectedYear}
              selectedPeriod={selectedPeriod}
              showDeposit={showDeposit}
              showWithdrawal={showWithdrawal}
              accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.nickname ?? a.bank_name }))}
              excludedAccountIds={excludedAccountIds}
            />
            <BankEntryPopup
              accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.nickname ?? a.bank_name }))}
              clients={clients ?? []}
              nameSuggestions={nameSuggestions}
            />
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <BankTransactionTable
            transactions={transactions ?? []}
            accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.nickname ?? a.bank_name }))}
            clients={clients ?? []}
            nameSuggestions={nameSuggestions}
          />
        </div>
      </div>
    </div>
  );
}
