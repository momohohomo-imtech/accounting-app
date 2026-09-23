import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { PageTabs } from "@/components/PageTabs";
import { CreditSection } from "@/components/sections/CreditSection";
import { ClientsSection } from "@/components/sections/ClientsSection";
import { PaymentMethodsSection } from "@/components/sections/PaymentMethodsSection";
import { ExpenseCategoriesSection } from "@/components/sections/ExpenseCategoriesSection";
import { YearMonthFilter } from "@/components/YearMonthFilter";
import { TransactionTable } from "@/components/TransactionTable";
import { TransactionColumnToggles } from "@/components/TransactionColumnToggles";
import { TransactionExportButtons } from "@/components/TransactionExportButtons";
import { ProjectTreeFilter } from "@/components/ProjectTreeFilter";
import { PaymentMethodFilter } from "@/components/PaymentMethodFilter";
import { TransactionBulkImport } from "@/components/TransactionBulkImport";
import { TransactionEditPopup } from "@/components/TransactionEditPopup";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LinkButton } from "@/components/ui/Button";
import { formatWon } from "@/lib/format";
import { monthRange } from "@/lib/dateRange";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";
import { fetchAllRows } from "@/lib/supabaseFetchAll";
import { nowKst } from "@/lib/kstDate";

const TABS = [
  { key: "list", label: "매입매출" },
  { key: "credit", label: "외상관리" },
  { key: "clients", label: "거래처" },
  { key: "payment-methods", label: "결제수단" },
  { key: "expense-categories", label: "지출카테고리" },
];

const FLOOR_YEAR = 2026;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    year?: string;
    month?: string;
    type?: string;
    project_id?: string;
    payment_method_id?: string;
    editTx?: string;
    showProject?: string;
    showCategory?: string;
    showItem?: string;
  }>;
}) {
  const { tab, year, month, type, project_id, payment_method_id, editTx, showProject, showCategory, showItem } =
    await searchParams;
  const active = tab ?? "list";

  const redirectTo = (() => {
    if (active !== "list") return `/transactions?tab=${active}`;
    const p = new URLSearchParams();
    if (year) p.set("year", year);
    if (month) p.set("month", month);
    if (type) p.set("type", type);
    if (project_id) p.set("project_id", project_id);
    if (payment_method_id) p.set("payment_method_id", payment_method_id);
    const qs = p.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  })();

  const totals =
    active === "list" ? await fetchTransactionTotals({ year, month, type, project_id, payment_method_id }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-bold text-slate-900">매입매출·외상</h1>
          {totals && (
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-slate-500">
              <span>
                총 매입액{" "}
                <span className="tabular-nums font-semibold text-slate-900">{formatWon(totals.purchase)}</span>
              </span>
              <span>
                총 매출액{" "}
                <span className="tabular-nums font-semibold text-slate-900">{formatWon(totals.sales)}</span>
              </span>
            </div>
          )}
        </div>
        {active === "list" && <LinkButton href="/transactions/new">+ 거래 등록</LinkButton>}
      </div>

      <PageTabs basePath="/transactions" tabs={TABS} active={active} />

      {active === "credit" && <CreditSection />}
      {active === "clients" && <ClientsSection />}
      {active === "payment-methods" && <PaymentMethodsSection />}
      {active === "expense-categories" && <ExpenseCategoriesSection />}
      {active === "list" && (
        <TransactionListSection
          year={year}
          month={month}
          type={type}
          project_id={project_id}
          payment_method_id={payment_method_id}
          showProject={showProject}
          showCategory={showCategory}
          showItem={showItem}
        />
      )}

      <TransactionEditPopup editTx={editTx} redirectTo={redirectTo} />
    </div>
  );
}

// 상단 합계와 아래 목록이 같은 조건의 거래를 쓰므로, 한 요청 안에서는 한 번만 조회해서 나눠 쓴다
// (React cache — 같은 인자면 같은 결과를 재사용). 외상 미완납 건은 장부에서 제외한 결과.
const loadLedgerTransactions = cache(
  async (start: string, end: string, type: string, projectId: string, paymentMethodId: string) => {
    const supabase = await createClient();
    const rawTransactions = await fetchAllRows<Transaction>((from, to) => {
      let q = supabase
        .from("transactions")
        .select("*, clients(name), projects(name), payment_methods(*), expense_categories(*)")
        .gte("trans_date", start)
        .lte("trans_date", end)
        .order("trans_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (type) q = q.eq("type", type);
      if (projectId) q = q.eq("project_id", projectId);
      if (paymentMethodId) q = q.eq("payment_method_id", paymentMethodId);
      return q;
    });
    const creditIds = rawTransactions.filter((t) => t.payment_type === "credit").map((t) => t.id);
    const relevantPayments = creditIds.length
      ? await fetchAllRows<CreditPayment>((from, to) =>
          supabase
            .from("credit_payments")
            .select("*")
            .in("transaction_id", creditIds)
            .order("id", { ascending: true })
            .range(from, to)
        )
      : [];
    return rawTransactions.filter((t) => isLedgerVisible(t, relevantPayments));
  }
);

async function fetchTransactionTotals({
  year,
  month,
  type,
  project_id,
  payment_method_id,
}: {
  year?: string;
  month?: string;
  type?: string;
  project_id?: string;
  payment_method_id?: string;
}) {
  const { year: currentYear, month: currentMonth } = nowKst();
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "current";
  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);
  const visible = await loadLedgerTransactions(start, end, type ?? "", project_id ?? "", payment_method_id ?? "");

  return {
    purchase: visible.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0),
    sales: visible.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0),
  };
}

async function TransactionListSection({
  year,
  month,
  type,
  project_id,
  payment_method_id,
  showProject,
  showCategory,
  showItem,
}: {
  year?: string;
  month?: string;
  type?: string;
  project_id?: string;
  payment_method_id?: string;
  showProject?: string;
  showCategory?: string;
  showItem?: string;
}) {
  const columnVisibility = {
    showProject: showProject !== "0",
    showCategory: showCategory !== "0",
    showItem: showItem !== "0",
  };
  const supabase = await createClient();
  const { year: currentYear, month: currentMonth } = nowKst();
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "current";

  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);

  const [
    transactions,
    { data: projectTree },
    { data: latestTx },
    { data: importClients },
    { data: importProjects },
    { data: importPaymentMethods },
    { data: importExpenseCategories },
  ] = await Promise.all([
    loadLedgerTransactions(start, end, type ?? "", project_id ?? "", payment_method_id ?? ""),
    supabase.from("projects").select("id, name, year, site_id, sites(name, clients(name))").order("name"),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: false }).limit(1),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("payment_methods").select("id, name, text_color, background_color").order("sort_order"),
    supabase.from("expense_categories").select("id, name").order("sort_order"),
  ]);

  const filteredNetTotal = transactions.reduce(
    (s, t) => s + (t.type === "매출" ? t.sales_amount + t.sales_vat : -(t.purchase_amount + t.purchase_vat)),
    0
  );

  const projectNodes = (projectTree ?? []).map((p) => {
    const site = one(p.sites) as { name: string; clients?: unknown } | undefined;
    const client = one(site?.clients) as { name: string } | undefined;
    return {
      id: p.id,
      name: p.name,
      year: p.year,
      siteId: p.site_id,
      siteName: site?.name ?? "미지정",
      clientName: client?.name ?? null,
    };
  });

  const maxDataYear = latestTx?.[0] ? Number(latestTx[0].trans_date.slice(0, 4)) : currentYear;
  const topYear = Math.max(currentYear, maxDataYear, selectedYear);
  const years = Array.from({ length: topYear - FLOOR_YEAR + 1 }, (_, i) => FLOOR_YEAR + i);

  function withParam(key: string, value: string) {
    const p = new URLSearchParams({
      year: String(selectedYear),
      month: selectedMonth,
      type: type ?? "",
      project_id: project_id ?? "",
      payment_method_id: payment_method_id ?? "",
    });
    if (value) p.set(key, value);
    else p.delete(key);
    return `/transactions?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <YearMonthFilter years={years} selectedYear={selectedYear} selectedMonth={selectedMonth} />
        <TransactionColumnToggles {...columnVisibility} />
        <PaymentMethodFilter paymentMethods={importPaymentMethods ?? []} />
        <div className="flex gap-1 print:hidden">
          {[
            { v: "", label: "전체" },
            { v: "매입", label: "매입" },
            { v: "매출", label: "매출" },
          ].map((t) => (
            <Pill key={t.v} href={withParam("type", t.v)} active={(type ?? "") === t.v}>
              {t.label}
            </Pill>
          ))}
        </div>
        <TransactionExportButtons transactions={transactions as Transaction[]} />
      </div>

      <p className="text-sm text-slate-600">
        필터된 전체 금액{" "}
        <span className={`tabular-nums font-semibold ${filteredNetTotal >= 0 ? "text-blue-700" : "text-red-600"}`}>
          {filteredNetTotal >= 0 ? "+" : "-"}
          {formatWon(Math.abs(filteredNetTotal))}
        </span>
        {" (매출 +, 매입 -)"}
      </p>

      <Card>
        <TransactionTable
          transactions={transactions as Transaction[]}
          projectNodes={projectNodes}
          clients={importClients ?? []}
          categories={importExpenseCategories ?? []}
          paymentMethods={importPaymentMethods ?? []}
          listParams={{ year: selectedYear, month: selectedMonth, type: type ?? "", project_id: project_id ?? "" }}
          {...columnVisibility}
        />
      </Card>

      {projectNodes.length > 0 && (
        <Card className="print:hidden">
          <ProjectTreeFilter basePath="/transactions" projects={projectNodes} selectedProjectId={project_id ?? ""} />
        </Card>
      )}

      <Card className="print:hidden">
        <h2 className="mb-3 font-semibold text-slate-900">엑셀로 여러 거래 한 번에 등록 (AI 자동 인식)</h2>
        <TransactionBulkImport
          clients={importClients ?? []}
          projects={importProjects ?? []}
          paymentMethods={importPaymentMethods ?? []}
          expenseCategories={importExpenseCategories ?? []}
        />
      </Card>
    </div>
  );
}
