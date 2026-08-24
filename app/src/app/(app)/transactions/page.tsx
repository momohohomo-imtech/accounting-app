import { createClient } from "@/lib/supabase/server";
import { PageTabs } from "@/components/PageTabs";
import { CreditSection } from "@/components/sections/CreditSection";
import { ClientsSection } from "@/components/sections/ClientsSection";
import { PaymentMethodsSection } from "@/components/sections/PaymentMethodsSection";
import { ExpenseCategoriesSection } from "@/components/sections/ExpenseCategoriesSection";
import { YearMonthFilter } from "@/components/YearMonthFilter";
import { TransactionTable } from "@/components/TransactionTable";
import { TransactionExportButtons } from "@/components/TransactionExportButtons";
import { ProjectTreeFilter } from "@/components/ProjectTreeFilter";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LinkButton } from "@/components/ui/Button";
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
  searchParams: Promise<{ tab?: string; year?: string; month?: string; type?: string; project_id?: string }>;
}) {
  const { tab, year, month, type, project_id } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">매입매출·외상</h1>
        {active === "list" && <LinkButton href="/transactions/new">+ 거래 등록</LinkButton>}
      </div>

      <PageTabs basePath="/transactions" tabs={TABS} active={active} />

      {active === "credit" && <CreditSection />}
      {active === "clients" && <ClientsSection />}
      {active === "payment-methods" && <PaymentMethodsSection />}
      {active === "expense-categories" && <ExpenseCategoriesSection />}
      {active === "list" && <TransactionListSection year={year} month={month} type={type} project_id={project_id} />}
    </div>
  );
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
    .select("*, clients(name), projects(name), payment_methods(*)")
    .neq("payment_type", "credit")
    .gte("trans_date", start)
    .lte("trans_date", end)
    .order("trans_date", { ascending: false });

  if (type) query = query.eq("type", type);
  if (project_id) query = query.eq("project_id", project_id);

  const [{ data: transactions }, { data: projectTree }, { data: latestTx }] = await Promise.all([
    query,
    supabase.from("projects").select("id, name, year, site_id, sites(name, clients(name))").order("name"),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: false }).limit(1),
  ]);

  const projectNodes = (projectTree ?? []).map((p) => {
    const site = p.sites?.[0] as { name: string; clients?: { name: string }[] } | undefined;
    const client = site?.clients?.[0] as { name: string } | undefined;
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <YearMonthFilter years={years} selectedYear={selectedYear} selectedMonth={selectedMonth} />
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
        <TransactionTable transactions={(transactions ?? []) as Transaction[]} />
      </Card>

      {projectNodes.length > 0 && (
        <Card className="print:hidden">
          <ProjectTreeFilter basePath="/transactions" projects={projectNodes} selectedProjectId={project_id ?? ""} />
        </Card>
      )}
    </div>
  );
}
