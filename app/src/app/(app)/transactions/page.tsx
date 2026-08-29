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
import { TransactionBulkImport } from "@/components/TransactionBulkImport";
import { TransactionEditPopup } from "@/components/TransactionEditPopup";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LinkButton } from "@/components/ui/Button";
import { formatWon } from "@/lib/format";
import type { Transaction } from "@/lib/types";

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
    editTx?: string;
    showProject?: string;
    showCategory?: string;
    showItem?: string;
  }>;
}) {
  const { tab, year, month, type, project_id, editTx, showProject, showCategory, showItem } = await searchParams;
  const active = tab ?? "list";

  const redirectTo = (() => {
    if (active !== "list") return `/transactions?tab=${active}`;
    const p = new URLSearchParams();
    if (year) p.set("year", year);
    if (month) p.set("month", month);
    if (type) p.set("type", type);
    if (project_id) p.set("project_id", project_id);
    const qs = p.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  })();

  const totals =
    active === "list" ? await fetchTransactionTotals({ year, month, type, project_id }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-bold text-slate-900">매입매출·외상</h1>
          {totals && (
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-slate-500">
              <span>
                총 매입액{" "}
                <span className="font-mono font-semibold text-slate-900">{formatWon(totals.purchase)}</span>
              </span>
              <span>
                총 매출액{" "}
                <span className="font-mono font-semibold text-slate-900">{formatWon(totals.sales)}</span>
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
          showProject={showProject}
          showCategory={showCategory}
          showItem={showItem}
        />
      )}

      <TransactionEditPopup editTx={editTx} redirectTo={redirectTo} />
    </div>
  );
}

async function fetchTransactionTotals({
  year,
  month,
  type,
  project_id,
}: {
  year?: string;
  month?: string;
  type?: string;
  project_id?: string;
}) {
  const supabase = await createClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "current";
  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);

  let query = supabase
    .from("transactions")
    .select("purchase_amount, purchase_vat, sales_amount, sales_vat")
    .neq("payment_type", "credit")
    .gte("trans_date", start)
    .lte("trans_date", end);
  if (type) query = query.eq("type", type);
  if (project_id) query = query.eq("project_id", project_id);

  const { data } = await query;
  return {
    purchase: (data ?? []).reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0),
    sales: (data ?? []).reduce((s, t) => s + t.sales_amount + t.sales_vat, 0),
  };
}

function monthRange(selectedYear: number, monthParam: string, currentMonth: number) {
  if (monthParam === "all") return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
  if (monthParam === "h1") return { start: `${selectedYear}-01-01`, end: `${selectedYear}-06-30` };
  if (monthParam === "h2") return { start: `${selectedYear}-07-01`, end: `${selectedYear}-12-31` };
  const m = monthParam === "current" ? currentMonth : Number(monthParam);
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(selectedYear, m, 0).getDate();
  return { start: `${selectedYear}-${mm}-01`, end: `${selectedYear}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

async function TransactionListSection({
  year,
  month,
  type,
  project_id,
  showProject,
  showCategory,
  showItem,
}: {
  year?: string;
  month?: string;
  type?: string;
  project_id?: string;
  showProject?: string;
  showCategory?: string;
  showItem?: string;
}) {
  const columnVisibility = {
    showProject: showProject !== "0",
    showCategory: showCategory === "1",
    showItem: showItem !== "0",
  };
  const supabase = await createClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "current";

  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);

  let query = supabase
    .from("transactions")
    .select("*, clients(name), projects(name), payment_methods(*), expense_categories(*)")
    .neq("payment_type", "credit")
    .gte("trans_date", start)
    .lte("trans_date", end)
    .order("trans_date", { ascending: false });

  if (type) query = query.eq("type", type);
  if (project_id) query = query.eq("project_id", project_id);

  const [
    { data: transactions },
    { data: projectTree },
    { data: latestTx },
    { data: importClients },
    { data: importProjects },
    { data: importPaymentMethods },
    { data: importExpenseCategories },
  ] = await Promise.all([
    query,
    supabase.from("projects").select("id, name, year, site_id, sites(name, clients(name))").order("name"),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: false }).limit(1),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("payment_methods").select("id, name").order("sort_order"),
    supabase.from("expense_categories").select("id, name").order("sort_order"),
  ]);

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
    });
    if (value) p.set(key, value);
    else p.delete(key);
    return `/transactions?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <h2 className="mb-3 font-semibold text-slate-900">엑셀로 여러 거래 한 번에 등록 (AI 자동 인식)</h2>
        <TransactionBulkImport
          clients={importClients ?? []}
          projects={importProjects ?? []}
          paymentMethods={importPaymentMethods ?? []}
          expenseCategories={importExpenseCategories ?? []}
        />
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <YearMonthFilter years={years} selectedYear={selectedYear} selectedMonth={selectedMonth} />
          <TransactionColumnToggles {...columnVisibility} />
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex gap-1">
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
          <TransactionExportButtons transactions={(transactions ?? []) as Transaction[]} />
        </div>
      </div>

      <Card>
        <TransactionTable
          transactions={(transactions ?? []) as Transaction[]}
          projectNodes={projectNodes}
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
    </div>
  );
}
