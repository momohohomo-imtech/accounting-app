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
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { PaymentMethodFilter } from "@/components/PaymentMethodFilter";
import { TransactionBulkImport } from "@/components/TransactionBulkImport";
import { TransactionEditPopup } from "@/components/TransactionEditPopup";
import { PageMemo } from "@/components/PageMemo";
import { TransactionWatchPanel } from "@/components/TransactionWatchPanel";
import { loadTransactionWatch } from "@/lib/transactionWatchLoad";
import { buildWatchEntries } from "@/lib/transactionWatch";
import { updateTransactionsPageMemo } from "@/lib/actions/transactionsPageMemo";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LinkButton } from "@/components/ui/Button";
import { formatWon } from "@/lib/format";
import { monthRange } from "@/lib/dateRange";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, Transaction } from "@/lib/types";
import { fetchAllRows, fetchAllData, fetchAllRowsIn } from "@/lib/supabaseFetchAll";
import { groupLedgerRows, hasPaymentGroupColumn } from "@/lib/paymentGroup";
import { applyLedgerSearch } from "@/lib/ledgerSearch";
import { LedgerSearchBox } from "@/components/LedgerSearchBox";
import { LedgerCheckSection } from "@/components/sections/LedgerCheckSection";
import { getCurrentRole } from "@/lib/currentRole";
import { isYearLocked, loadLockedYears, type LockedYear } from "@/lib/yearLock";
import { nowKst } from "@/lib/kstDate";

const TABS = [
  { key: "list", label: "매입매출" },
  { key: "credit", label: "외상관리" },
  { key: "clients", label: "거래처" },
  { key: "payment-methods", label: "결제수단" },
  { key: "expense-categories", label: "지출카테고리" },
  { key: "check", label: "장부 점검" },
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
    showMemo?: string;
    q?: string;
  }>;
}) {
  const { tab, year, month, type, project_id, payment_method_id, editTx, showProject, showCategory, showItem, showMemo, q } =
    await searchParams;
  // 세무사 계정은 매입매출장(매입매출 목록)만 — 다른 탭·등록·수정 없이 읽기만(사용자 요청 10/28, 미들웨어에서도 막음).
  const ledgerOnly = (await getCurrentRole()) === "tax_agent";
  const active = ledgerOnly ? "list" : (tab ?? "list");

  const redirectTo = (() => {
    if (active === "check" && year) return `/transactions?tab=check&year=${year}`;
    if (active !== "list") return `/transactions?tab=${active}`;
    const p = new URLSearchParams();
    if (year) p.set("year", year);
    if (month) p.set("month", month);
    if (type) p.set("type", type);
    if (project_id) p.set("project_id", project_id);
    if (payment_method_id) p.set("payment_method_id", payment_method_id);
    if (q?.trim()) p.set("q", q.trim());
    const qs = p.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  })();

  const totals =
    active === "list" ? await fetchTransactionTotals({ year, month, type, project_id, payment_method_id, q }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{ledgerOnly ? "매입매출" : "매입매출·외상"}</h1>
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
        {active === "list" && !ledgerOnly && <LinkButton href="/transactions/new">+ 거래 등록</LinkButton>}
      </div>

      {!ledgerOnly && <PageTabs basePath="/transactions" tabs={TABS} active={active} />}

      {active === "credit" && <CreditSection />}
      {active === "clients" && <ClientsSection />}
      {active === "payment-methods" && <PaymentMethodsSection />}
      {active === "expense-categories" && <ExpenseCategoriesSection />}
      {active === "check" && <LedgerCheckTab year={year} />}
      {active === "list" && (
        <TransactionListSection
          year={year}
          month={month}
          type={type}
          project_id={project_id}
          payment_method_id={payment_method_id}
          q={q}
          showProject={showProject}
          showCategory={showCategory}
          showItem={showItem}
          showMemo={showMemo}
          readOnly={ledgerOnly}
        />
      )}

      {!ledgerOnly && <TransactionEditPopup editTx={editTx} redirectTo={redirectTo} />}
    </div>
  );
}

// 장부 점검 탭 — 연도는 2026(앱 시작)부터 올해(또는 고른 해)까지.
function LedgerCheckTab({ year }: { year?: string }) {
  const currentYear = nowKst().year;
  const selectedYear = year ? Number(year) : currentYear;
  const topYear = Math.max(currentYear, selectedYear);
  const years = Array.from({ length: topYear - FLOOR_YEAR + 1 }, (_, i) => topYear - i);
  return <LedgerCheckSection year={selectedYear} years={years} />;
}

// 086 SQL 실행 전이라 표가 없어도 에러 없이 빈 메모로 보이게 data만 쓴다.
async function loadPageMemo() {
  const supabase = await createClient();
  const { data } = await supabase.from("transactions_page_memo").select("content").maybeSingle();
  return data;
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
        // 같은 날짜 안은 나중에 등록한 것이 위(lib/entryOrder.ts — 화면 표·엑셀 순서)
        .order("trans_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (type) q = q.eq("type", type);
      if (projectId) q = q.eq("project_id", projectId);
      if (paymentMethodId) q = q.eq("payment_method_id", paymentMethodId);
      return q;
    });
    // 한 해 전체를 보면 외상이 수백 건일 수 있어 요청 주소가 너무 길어지지 않게 나눠 조회(fetchAllRowsIn).
    const creditIds = rawTransactions.filter((t) => t.payment_type === "credit").map((t) => t.id);
    const relevantPayments = creditIds.length
      ? await fetchAllRowsIn<CreditPayment>(creditIds, (ids, from, to) =>
          supabase
            .from("credit_payments")
            .select("*")
            .in("transaction_id", ids)
            .order("id", { ascending: true })
            .range(from, to)
        )
      : [];
    // 외상 정산일(거래마다 마지막 정산 이력) — 매입장의 외상 정산 묶음 줄에 "MM-DD 정산"으로 보여 줌.
    const paidDateById: Record<string, string> = {};
    for (const p of relevantPayments) {
      if (!paidDateById[p.transaction_id] || p.paid_date > paidDateById[p.transaction_id]) {
        paidDateById[p.transaction_id] = p.paid_date;
      }
    }
    return { rows: rawTransactions.filter((t) => isLedgerVisible(t, relevantPayments)), paidDateById };
  }
);

async function fetchTransactionTotals({
  year,
  month,
  type,
  project_id,
  payment_method_id,
  q,
}: {
  year?: string;
  month?: string;
  type?: string;
  project_id?: string;
  payment_method_id?: string;
  q?: string;
}) {
  const { year: currentYear, month: currentMonth } = nowKst();
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "current";
  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);
  const { rows } = await loadLedgerTransactions(start, end, type ?? "", project_id ?? "", payment_method_id ?? "");
  // 글자 검색(?q=)을 했으면 상단 합계도 검색된 거래만(목록과 같게, lib/ledgerSearch.ts)
  const visible = applyLedgerSearch(rows, q);

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
  q,
  showProject,
  showCategory,
  showItem,
  showMemo,
  readOnly = false,
}: {
  year?: string;
  month?: string;
  type?: string;
  project_id?: string;
  payment_method_id?: string;
  q?: string;
  showProject?: string;
  showCategory?: string;
  showItem?: string;
  showMemo?: string;
  // 세무사 계정 — 장부만(메모·엑셀 일괄 등록·체크·수정·삭제 없이).
  readOnly?: boolean;
}) {
  const columnVisibility = {
    showProject: showProject !== "0",
    showCategory: showCategory !== "0",
    showItem: showItem !== "0",
    // 메모 앞 6글자(사용자 요청 11/1) — 다른 칸처럼 기본은 보이고 체크를 끄면 숨김.
    showMemo: showMemo !== "0",
  };
  const supabase = await createClient();
  const { year: currentYear, month: currentMonth } = nowKst();
  const selectedYear = year ? Number(year) : currentYear;
  const selectedMonth = month ?? "current";

  const { start, end } = monthRange(selectedYear, selectedMonth, currentMonth);

  const [
    { rows: periodTransactions, paidDateById },
    { data: projectTree },
    { data: latestTx },
    { data: importClients },
    { data: importProjects },
    { data: importPaymentMethods },
    { data: importExpenseCategories },
    pageMemo,
    locks,
    watch,
    role,
  ] = await Promise.all([
    loadLedgerTransactions(start, end, type ?? "", project_id ?? "", payment_method_id ?? ""),
    fetchAllData((from, to) =>
      supabase
        .from("projects")
        .select("id, name, year, site_id, sites(name, clients(name))")
        .order("name")
        .order("id")
        .range(from, to)
    ),
    supabase.from("transactions").select("trans_date").order("trans_date", { ascending: false }).limit(1),
    fetchAllData((from, to) => supabase.from("clients").select("id, name").order("name").order("id").range(from, to)),
    fetchAllData((from, to) => supabase.from("projects").select("id, name").order("name").order("id").range(from, to)),
    supabase.from("payment_methods").select("id, name, text_color, background_color").order("sort_order"),
    supabase.from("expense_categories").select("id, name").order("sort_order"),
    readOnly ? Promise.resolve(null) : loadPageMemo(),
    // 신고 끝난 해 잠금(097 SQL) — 실행 전이면 안내 없음.
    loadLockedYears(() =>
      supabase
        .from("locked_years")
        .select("year, locked_at, memo")
        .then(({ data, error }) => ({ data: data as LockedYear[] | null, error }))
    ),
    // "챙길 거래" 창(105 SQL) — 세무사 계정은 안 봄, 표가 없으면(실행 전) ready=false라 창·📌 칸을 숨김.
    readOnly ? Promise.resolve(null) : loadTransactionWatch(supabase),
    getCurrentRole(),
  ]);
  // 📌 올리기·빼기·메모는 관리자·직원만(조회 전용은 창을 보기만)
  const canEditWatch = role === "admin" || role === "staff";
  const watchEntries = watch ? buildWatchEntries(watch.rows) : [];
  const yearLocked = isYearLocked(locks.years, selectedYear);
  // 글자 검색(?q=, 11/7) — 고른 기간·필터의 거래 안에서 거래처·품목·메모 등으로 거름(한 결제 묶음은 묶음째)
  const searchText = q?.trim() ?? "";
  const transactions = applyLedgerSearch(periodTransactions, searchText);
  const shownRowCount = groupLedgerRows(transactions).length;

  // 092 SQL 실행 전에는 거래에 묶음 번호 칸이 없음 → 묶기 버튼을 숨김(거래가 없으면 고를 것도 없어서 상관없음).
  const groupingReady = hasPaymentGroupColumn(periodTransactions);

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
    if (searchText) p.set("q", searchText);
    if (value) p.set(key, value);
    else p.delete(key);
    return `/transactions?${p.toString()}`;
  }

  const selectedProjectNode = project_id ? projectNodes.find((p) => p.id === project_id) : undefined;
  const showWatchPanel = Boolean(watch?.ready && (watchEntries.length > 0 || watch.error));

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
        <LedgerSearchBox key={searchText} initial={searchText} />
        <TransactionExportButtons transactions={transactions as Transaction[]} />
      </div>
      {/* 위쪽 정리(11/11 사용자 "화면 정리" — 메모칸이 고르는 칸 줄 끝에 붙고 "챙길 거래" 창만 오른쪽 끝으로 밀려 서로 어긋나고 왼쪽이
          비었음): 고르는 칸·검색·인쇄·엑셀은 위 줄, 그 아래 줄은 왼쪽 = 필터된 전체 금액, 오른쪽 = 메모칸 + 바로 아래 챙길 거래 창(같은
          폭). 노트북 폭(xl)보다 좁으면 메모칸 → 창 → 금액 줄 순서로 위아래(전체 폭). */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <p className="text-sm text-slate-600 xl:pt-2">
          필터된 전체 금액{" "}
          <span className={`tabular-nums font-semibold ${filteredNetTotal >= 0 ? "text-brand" : "text-red-600"}`}>
            {filteredNetTotal >= 0 ? "+" : "-"}
            {formatWon(Math.abs(filteredNetTotal))}
          </span>
          {" (매출 +, 매입 -)"}
          {searchText && (
            <span className="ml-2 font-medium text-slate-800">
              · 검색 &ldquo;{searchText}&rdquo; {shownRowCount.toLocaleString("ko-KR")}건
            </span>
          )}
        </p>
        {!readOnly && (
          <div className="order-first w-full space-y-2 print:hidden xl:order-none xl:w-[34rem] xl:shrink-0 2xl:w-[40rem]">
            <PageMemo
              bare
              rows={2}
              initialContent={pageMemo?.content ?? ""}
              placeholder="매입매출 관련 메모..."
              save={updateTransactionsPageMemo}
            />
            {showWatchPanel && watch && (
              <TransactionWatchPanel
                entries={watchEntries}
                listParams={{ year: selectedYear, month: selectedMonth, type: type ?? "", project_id: project_id ?? "", q: searchText }}
                canEdit={canEditWatch}
                error={watch.error}
                currentYear={currentYear}
              />
            )}
          </div>
        )}
      </div>
      {yearLocked && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {selectedYear}년은 신고가 끝나 잠긴 해입니다 — 거래를 추가·삭제하거나 날짜·금액·거래처·카테고리·세금계산서·외상 여부를 바꿀
          수 없습니다(프로젝트·결제수단·품목·메모·외상 정산은 가능).
        </p>
      )}

      <Card>
        <TransactionTable
          transactions={transactions as Transaction[]}
          projectNodes={projectNodes}
          clients={importClients ?? []}
          categories={importExpenseCategories ?? []}
          paymentMethods={importPaymentMethods ?? []}
          listParams={{ year: selectedYear, month: selectedMonth, type: type ?? "", project_id: project_id ?? "", q: searchText }}
          emptyText={searchText ? `“${searchText}” 검색에 맞는 거래가 없습니다.` : undefined}
          groupingReady={groupingReady}
          paidDateById={paidDateById}
          readOnly={readOnly}
          watchReady={Boolean(watch?.ready && !watch.error) && canEditWatch}
          watchEntries={watchEntries}
          currentYear={currentYear}
          {...columnVisibility}
        />
      </Card>

      {/* 프로젝트 필터는 표 아래에 접어 둠(사용자 요청 — 자주 안 씀). 프로젝트로 거른 상태면 펼쳐서, 어떤 프로젝트로
          걸렀는지 보이게 */}
      {projectNodes.length > 0 && (
        <CollapsibleSection
          title={
            selectedProjectNode
              ? `프로젝트 필터 — ${selectedProjectNode.name}`
              : "프로젝트 필터"
          }
          defaultOpen={Boolean(selectedProjectNode)}
          className="print:hidden"
        >
          <ProjectTreeFilter basePath="/transactions" projects={projectNodes} selectedProjectId={project_id ?? ""} />
        </CollapsibleSection>
      )}

      {!readOnly && (
        <Card className="print:hidden">
          <h2 className="mb-3 font-semibold text-slate-900">엑셀로 여러 거래 한 번에 등록</h2>
          <TransactionBulkImport
            clients={importClients ?? []}
            projects={importProjects ?? []}
            paymentMethods={importPaymentMethods ?? []}
            expenseCategories={importExpenseCategories ?? []}
          />
        </Card>
      )}
    </div>
  );
}
