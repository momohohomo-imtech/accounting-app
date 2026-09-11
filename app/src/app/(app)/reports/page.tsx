import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatWon, formatDate } from "@/lib/format";
import { ProjectProfitReport } from "@/components/ProjectProfitReport";
import { VendorDetailReport } from "@/components/VendorDetailReport";
import { YearFilter } from "@/components/YearFilter";
import { ReportProjectSiteFilter } from "@/components/ReportProjectSiteFilter";
import { ReportProjectPicker } from "@/components/ReportProjectPicker";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { AutoPrint } from "@/components/AutoPrint";
import { ReportAIInsights } from "@/components/ReportAIInsights";
import { saveReportAiInsight, deleteReportAiInsight } from "@/lib/actions/reportAiInsights";
import { isLedgerVisible } from "@/lib/credit";
import { resolveCategoryColor } from "@/lib/categoryColor";
import type { ReportAiInsight, CreditPayment } from "@/lib/types";
import { VendorAggregateTable } from "@/components/VendorAggregateTable";
import { VendorAgencyToggle } from "@/components/VendorAgencyToggle";
import { ClassificationPendingTable } from "@/components/ClassificationPendingTable";
import { CategoryAggregateTable } from "@/components/CategoryAggregateTable";
import { CategoryDetailReport } from "@/components/CategoryDetailReport";
import { ProjectProfitTable } from "@/components/ProjectProfitTable";
import { RevenueVerificationTable } from "@/components/RevenueVerificationTable";
import { TransactionEditPopup } from "@/components/TransactionEditPopup";
import { WorkLogSummaryTable } from "@/components/WorkLogSummaryTable";
import { WorkLogMonthRangeFilter } from "@/components/WorkLogMonthRangeFilter";
import { WorkLogSiteFilter } from "@/components/WorkLogSiteFilter";
import { UnassignedWorkLogTable } from "@/components/UnassignedWorkLogTable";
import { UnassignedWorkLogMonthFilter } from "@/components/UnassignedWorkLogMonthFilter";
import { buildWorkLogSummary } from "@/lib/workLogSummary";
import { parseMonthRange } from "@/lib/monthRange";
import { ReportExcelButton } from "@/components/ReportExcelButton";
import type { WorkLog } from "@/lib/types";

const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

type Row = {
  id: string;
  trans_date: string;
  type: string;
  payment_type: string;
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  item_name: string | null;
  sales_amount: number;
  sales_vat: number;
  purchase_amount: number;
  purchase_vat: number;
  needs_classification: boolean;
  clients: { name: string } | { name: string }[] | null;
  projects:
    | { name: string; status: string | null; sites: { name: string } | { name: string }[] | null }
    | { name: string; status: string | null; sites: { name: string } | { name: string }[] | null }[]
    | null;
  expense_categories:
    | { name: string; project_only: boolean; color: string | null }
    | { name: string; project_only: boolean; color: string | null }[]
    | null;
  payment_methods: { name: string } | { name: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}


export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    project?: string;
    vendor?: string;
    vendorAgency?: string;
    category?: string;
    site?: string;
    editTx?: string;
    wlMonths?: string;
    wlSite?: string;
    unassignedMonth?: string;
    printSection?: string;
  }>;
}) {
  const {
    year,
    project,
    vendor,
    vendorAgency,
    category,
    site,
    editTx,
    wlMonths,
    wlSite,
    unassignedMonth,
    printSection,
  } = await searchParams;
  const includeVendorAgency = vendorAgency === "1";
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;

  const supabase = await createClient();
  const [
    { data: rawTx },
    { data: projects },
    { data: firstTx },
    { data: savedInsights },
    { data: creditPayments },
    { data: agencyPurchases },
    { data: expenseCategories },
    { data: clientRows },
  ] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "*, clients(name), projects(name, status, sites(name)), expense_categories(name, project_only, color), payment_methods(name)"
        )
        .gte("trans_date", `${selectedYear}-01-01`)
        .lte("trans_date", `${selectedYear}-12-31`),
      supabase
        .from("projects")
        .select("id, name, status, progress_pct, site_id, quote_amount, contract_amount, settlement_finalized, sites(name)")
        .eq("year", selectedYear),
      supabase.from("transactions").select("trans_date").order("trans_date", { ascending: true }).limit(1),
      supabase
        .from("report_ai_insights")
        .select("*")
        .eq("year", selectedYear)
        .order("created_at", { ascending: false }),
      supabase.from("credit_payments").select("*"),
      supabase
        .from("project_agency_purchases")
        .select(
          "id, project_id, item_name, amount, client_name, memo, category_id, expense_categories(name, project_only, color), projects!inner(year, name, status)"
        )
        .eq("projects.year", selectedYear),
      supabase.from("expense_categories").select("id, name, project_only, color").order("sort_order"),
      supabase.from("clients").select("name").order("name"),
    ]);

  const clientNames = (clientRows ?? []).map((c) => c.name);

  const transactions = ((rawTx ?? []) as unknown as Row[]).filter((t) =>
    isLedgerVisible(t, (creditPayments ?? []) as CreditPayment[])
  );

  const firstYear = Math.min(
    firstTx?.[0]?.trans_date ? Number(firstTx[0].trans_date.slice(0, 4)) : currentYear,
    currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  if (!years.includes(selectedYear)) years.unshift(selectedYear);
  years.sort((a, b) => b - a);

  const monthly = MONTH_LABELS.map((label, i) => {
    const rows = transactions.filter((t) => new Date(t.trans_date).getMonth() === i);
    const sales = rows.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
    const purchase = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
    return { label, sales, purchase, profit: sales - purchase };
  });

  const quarterly = [0, 1, 2, 3].map((q) => {
    const months = monthly.slice(q * 3, q * 3 + 3);
    return {
      label: `${q + 1}분기`,
      sales: months.reduce((s, m) => s + m.sales, 0),
      purchase: months.reduce((s, m) => s + m.purchase, 0),
      profit: months.reduce((s, m) => s + m.profit, 0),
    };
  });

  const yearTotal = {
    sales: monthly.reduce((s, m) => s + m.sales, 0),
    purchase: monthly.reduce((s, m) => s + m.purchase, 0),
  };

  const agencyByProject = new Map<string, number>();
  for (const a of agencyPurchases ?? []) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + a.amount);
  }

  const byProjectAll = (projects ?? []).map((p) => {
    const rows = transactions.filter((t) => t.project_id === p.id);
    // 손익 계산 시 매출은 부가세를 뺀 금액을 사용 (VAT는 실제 이익이 아닌 세무서 납부분).
    // 매출 총액(부가세 포함분)을 1.1로 나눠서 부가세만큼만 정확히 제외한다.
    const salesGross = rows.reduce((s, t) => s + t.sales_amount + t.sales_vat, 0);
    const sales = Math.round(salesGross / 1.1);
    const purchase = rows.reduce((s, t) => s + t.purchase_amount + t.purchase_vat, 0);
    const quoteAmount = p.quote_amount ?? 0;
    const agencyAmount = agencyByProject.get(p.id) ?? 0;
    // 프로젝트 손익보고서 팝업과 동일한 방식(발주액-매입-대행구매액)으로 통일.
    const profit = quoteAmount - purchase - agencyAmount;
    // 수주액이 발주액-대행구매액과 다르면(입력 실수 가능성) 프로젝트명을 노란색으로 표시.
    // 단, 결산 정리가 끝난 프로젝트는 목록에서 일반 검정으로 되돌림(보고서 팝업 안 경고는 별개, 항상 유지).
    const contractMismatch =
      !p.settlement_finalized && (p.contract_amount ?? 0) > 0 && quoteAmount - (p.contract_amount ?? 0) - agencyAmount !== 0;
    return { ...p, quoteAmount, sales, purchase, profit, contractMismatch };
  });

  const projectSiteOptions = Array.from(
    new Map(
      (projects ?? [])
        .filter((p) => p.site_id)
        .map((p) => [p.site_id as string, (one(p.sites) as { name: string } | null)?.name ?? "-"])
    ).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const byProject = site ? byProjectAll.filter((p) => p.site_id === site) : byProjectAll;

  // 매출 검증: 수주액(실수령액으로 입력해둔 금액)과 실제 매출 원장(세금계산서 기준) 합계를
  // 대조 — 수주액 필드만 입력되고 원장에 매출이 안 찍혔거나, 반대로 원장엔 매출이 있는데
  // 수주액이 비어있거나, 금액이 서로 다른 경우를 찾아낸다.
  const revenueVerificationRows = byProject
    .filter((p) => (p.contract_amount ?? 0) > 0 || p.sales > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      siteName: (one(p.sites) as { name: string } | null)?.name ?? null,
      status: p.status,
      quoteAmount: p.quoteAmount,
      contractAmount: p.contract_amount ?? 0,
      ledgerSales: p.sales,
    }));

  const projectSummaryQuoteAmount = byProject.reduce((s, p) => s + p.quoteAmount, 0);
  const projectSummaryProfit = byProject.reduce((s, p) => s + p.profit, 0);
  const projectSummary = {
    count: byProject.length,
    sales: byProject.reduce((s, p) => s + p.sales, 0),
    purchase: byProject.reduce((s, p) => s + p.purchase, 0),
    quoteAmount: projectSummaryQuoteAmount,
    profit: projectSummaryProfit,
    profitRate: projectSummaryQuoteAmount > 0 ? (projectSummaryProfit / projectSummaryQuoteAmount) * 100 : null,
  };

  // 현장별 손익 (프로젝트 없는 일반경비는 별도 묶음)
  const siteMap = new Map<string, { name: string; sales: number; purchase: number }>();
  for (const t of transactions) {
    const proj = one(t.projects);
    const s = proj ? one(proj.sites) : null;
    const key = s?.name ?? "일반경비(현장 외)";
    const entry = siteMap.get(key) ?? { name: key, sales: 0, purchase: 0 };
    entry.sales += t.sales_amount + t.sales_vat;
    entry.purchase += t.purchase_amount + t.purchase_vat;
    siteMap.set(key, entry);
  }
  const bySite = Array.from(siteMap.values())
    .map((s) => ({ ...s, profit: s.sales - s.purchase }))
    .sort((a, b) => b.sales + b.purchase - (a.sales + a.purchase));

  // 거래처별 매입/매출 집계
  function clientBreakdown(type: "매입" | "매출") {
    const map = new Map<string, { name: string; count: number; amount: number }>();
    for (const t of transactions.filter((t) => t.type === type)) {
      const client = one(t.clients);
      const name = client?.name ?? t.client_name_raw ?? "미지정";
      const amount = type === "매입" ? t.purchase_amount + t.purchase_vat : t.sales_amount + t.sales_vat;
      const entry = map.get(name) ?? { name, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += amount;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }
  const byCustomer = clientBreakdown("매출");

  // 매입처별 대행구매 집계 (거래처명 기준 — 체크박스로 매입 집계와 합산해서 보여줄 때 씀)
  const agencyByVendorMap = new Map<string, { name: string; count: number; amount: number }>();
  for (const a of agencyPurchases ?? []) {
    const name = a.client_name ?? "미지정";
    const entry = agencyByVendorMap.get(name) ?? { name, count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += a.amount;
    agencyByVendorMap.set(name, entry);
  }

  const byVendorPurchaseOnly = clientBreakdown("매입");
  const byVendor = includeVendorAgency
    ? (() => {
        const merged = new Map<string, { name: string; count: number; amount: number }>();
        for (const v of byVendorPurchaseOnly) merged.set(v.name, { ...v });
        for (const a of agencyByVendorMap.values()) {
          const existing = merged.get(a.name);
          if (existing) {
            existing.count += a.count;
            existing.amount += a.amount;
          } else {
            merged.set(a.name, { ...a });
          }
        }
        return Array.from(merged.values()).sort((x, y) => y.amount - x.amount);
      })()
    : byVendorPurchaseOnly;

  // 프로젝트 분류 대기 중인 거래 (엑셀 대량입력에서 프로젝트명은 인식했지만 실제
  // project_id 매칭을 못 찾아 담당자 확인이 필요한 건들)
  const classificationPendingRows = transactions
    .filter((t) => t.needs_classification)
    .map((t) => {
      const client = one(t.clients) as { name: string } | null;
      return {
        id: t.id,
        date: t.trans_date,
        type: t.type,
        clientName: client?.name ?? t.client_name_raw ?? "미지정",
        itemName: t.item_name ?? "-",
        amount: t.type === "매출" ? t.sales_amount + t.sales_vat : t.purchase_amount + t.purchase_vat,
        editHref: `/reports?year=${selectedYear}${site ? `&site=${site}` : ""}&editTx=${t.id}`,
      };
    });

  // 카테고리별 매입 집계
  const byCategory = (() => {
    const map = new Map<string, { name: string; count: number; amount: number; color?: string }>();
    for (const t of transactions.filter((t) => t.type === "매입")) {
      const category = one(t.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
      const name = category?.name ?? "미분류";
      const entry = map.get(name) ?? { name, count: 0, amount: 0, color: category ? resolveCategoryColor(category) : undefined };
      entry.count += 1;
      entry.amount += t.purchase_amount + t.purchase_vat;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  })();

  // 카테고리별 대행구매 집계 (매입장과 별개 — 절대 합산하지 않고 별도 컬럼으로만 표시)
  const agencyByCategory = (() => {
    const map = new Map<string, { name: string; count: number; amount: number; color?: string }>();
    for (const a of agencyPurchases ?? []) {
      const category = one(a.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
      const name = category?.name ?? "미분류";
      const entry = map.get(name) ?? { name, count: 0, amount: 0, color: category ? resolveCategoryColor(category) : undefined };
      entry.count += 1;
      entry.amount += a.amount;
      map.set(name, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  })();

  const pad = (n: number) => String(n).padStart(2, "0");
  const wlMonthRange = parseMonthRange(wlMonths);
  const wlStart = `${selectedYear}-${pad(wlMonthRange.start)}-01`;
  const wlEndLastDay = new Date(selectedYear, wlMonthRange.end, 0).getDate();
  const wlEnd = `${selectedYear}-${pad(wlMonthRange.end)}-${pad(wlEndLastDay)}`;

  const unassignedMonthNum = unassignedMonth ? Number(unassignedMonth) : null;
  const uStart = unassignedMonthNum ? `${selectedYear}-${pad(unassignedMonthNum)}-01` : `${selectedYear}-01-01`;
  const uEndDay = unassignedMonthNum ? new Date(selectedYear, unassignedMonthNum, 0).getDate() : 31;
  const uEnd = unassignedMonthNum
    ? `${selectedYear}-${pad(unassignedMonthNum)}-${pad(uEndDay)}`
    : `${selectedYear}-12-31`;

  const [{ data: wlRows }, { data: wlSites }, { data: unassignedLogRows }, { data: wlChecks }] = await Promise.all([
    supabase.from("work_logs").select("*").gte("log_date", wlStart).lte("log_date", wlEnd),
    supabase.from("sites").select("id, name, color"),
    supabase
      .from("work_logs")
      .select("id, log_date, site_id, title")
      .not("site_id", "is", null)
      .is("project_id", null)
      .gte("log_date", uStart)
      .lte("log_date", uEnd)
      .order("log_date", { ascending: true }),
    supabase.from("work_log_summary_checks").select("group_key").eq("year", selectedYear),
  ]);

  const wlRowsFiltered = wlSite ? (wlRows ?? []).filter((r) => r.site_id === wlSite) : wlRows ?? [];
  const workLogSummaryRaw = buildWorkLogSummary(wlRowsFiltered as WorkLog[], wlSites ?? []);
  // 특정 현장으로 좁혀보면 현장에 안 묶이는 휴무/사내/기타 특수 항목은 그 현장 이야기가 아니라서 뺌.
  const workLogSummary = wlSite ? workLogSummaryRaw.filter((r) => !r.isSpecial) : workLogSummaryRaw;
  const workLogTotalDays = new Set(wlRowsFiltered.map((r) => r.log_date)).size;

  const siteNameById = new Map((wlSites ?? []).map((s) => [s.id, s.name]));
  const unassignedRows = (unassignedLogRows ?? []).map((r) => ({
    id: r.id,
    date: r.log_date,
    siteName: siteNameById.get(r.site_id ?? "") ?? "-",
    title: r.title ?? "",
  }));
  const unassignedDayCount = new Set(unassignedRows.map((r) => r.date)).size;

  // 카테고리별 집계 팝업 — 매입 내역 + 대행구매 내역을 합쳐서 보여줌
  const categoryPurchaseRows = category
    ? transactions
        .filter((t) => t.type === "매입")
        .filter((t) => {
          const c = one(t.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
          return (c?.name ?? "미분류") === category;
        })
        .map((t) => {
          const client = one(t.clients) as { name: string } | null;
          const proj = one(t.projects) as { name: string; status: string | null } | null;
          return {
            id: t.id,
            kind: "매입" as const,
            trans_date: t.trans_date as string | null,
            client_name: client?.name ?? t.client_name_raw ?? "미지정",
            project_name: proj?.name ?? null,
            project_status: proj?.status ?? null,
            item_name: t.item_name,
            amount: t.purchase_amount + t.purchase_vat,
          };
        })
    : [];

  const categoryAgencyRows = category
    ? (agencyPurchases ?? [])
        .filter((a) => {
          const c = one(a.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
          return (c?.name ?? "미분류") === category;
        })
        .map((a) => {
          const proj = one(a.projects) as { name: string; status: string | null } | null;
          return {
            id: a.id,
            kind: "대행구매" as const,
            trans_date: null as string | null,
            client_name: a.client_name,
            project_name: proj?.name ?? null,
            project_status: proj?.status ?? null,
            item_name: a.item_name,
            amount: a.amount,
            category_id: a.category_id as string | null,
            memo: a.memo as string | null,
          };
        })
    : [];

  const vendorRows = vendor
    ? transactions
        .filter((t) => t.type === "매입" && ((one(t.clients) as { name: string } | null)?.name ?? t.client_name_raw ?? "미지정") === vendor)
        .map((t) => {
          const category = one(t.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
          const proj = one(t.projects) as { name: string; status: string | null } | null;
          return {
            id: t.id,
            kind: "매입" as const,
            trans_date: t.trans_date as string | null,
            item_name: t.item_name,
            amount: t.purchase_amount + t.purchase_vat,
            project_name: proj?.name ?? null,
            project_status: proj?.status ?? null,
            needs_classification: t.needs_classification,
            category_name: category?.name ?? null,
            category_project_only: category?.project_only ?? false,
            category_color: category?.color ?? null,
            payment_method_name: (one(t.payment_methods) as { name: string } | null)?.name ?? null,
          };
        })
    : [];

  const vendorAgencyRows =
    vendor && includeVendorAgency
      ? (agencyPurchases ?? [])
          .filter((a) => (a.client_name ?? "미지정") === vendor)
          .map((a) => {
            const category = one(a.expense_categories) as { name: string; project_only: boolean; color: string | null } | null;
            const proj = one(a.projects) as { name: string; status: string | null } | null;
            return {
              id: a.id,
              kind: "대행구매" as const,
              trans_date: null as string | null,
              item_name: a.item_name,
              amount: a.amount,
              project_name: proj?.name ?? null,
              project_status: proj?.status ?? null,
              needs_classification: false,
              category_name: category?.name ?? null,
              category_project_only: category?.project_only ?? false,
              category_color: category?.color ?? null,
              payment_method_name: null,
            };
          })
      : [];

  const vendorAllRows = [...vendorRows, ...vendorAgencyRows];

  const popupOpen = Boolean(project || vendor || category);
  const isolate = Boolean(printSection);

  // 항목별 "인쇄" 버튼 — 해당 항목 하나만 남기고 나머지는 인쇄에서 숨긴 채로
  // 새로 접속해서(?printSection=키) AutoPrint가 자동으로 인쇄창을 띄움. 인쇄창이
  // 닫히면 printSection만 뺀 현재 필터 그대로 되돌아감(cleanupHref).
  function reportUrl(extra?: { printSection: string }) {
    const p = new URLSearchParams();
    p.set("year", String(selectedYear));
    if (site) p.set("site", site);
    if (includeVendorAgency) p.set("vendorAgency", "1");
    if (wlMonths) p.set("wlMonths", wlMonths);
    if (wlSite) p.set("wlSite", wlSite);
    if (unassignedMonth) p.set("unassignedMonth", unassignedMonth);
    if (extra?.printSection) p.set("printSection", extra.printSection);
    return `/reports?${p.toString()}`;
  }
  function hiddenClass(key: string) {
    return popupOpen || (isolate && printSection !== key) ? "print:hidden" : "";
  }
  function printLink(section: string) {
    return (
      <Link
        href={reportUrl({ printSection: section })}
        className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 print:hidden"
      >
        인쇄
      </Link>
    );
  }

  // 각 항목 headerExtra에 공통으로 들어가는 "(항목별 부가 컨트롤 +) 엑셀 + 인쇄" 조합.
  // 필터·요약처럼 항목마다 다른 부가 컨트롤은 extra로 앞에 얹어서 함께 표시.
  function sectionControls(
    section: string,
    excel: { filename: string; headers: string[]; rows: (string | number)[][] },
    extra?: ReactNode
  ) {
    return (
      <div className="flex items-center gap-2 print:hidden">
        {extra}
        <ReportExcelButton filename={excel.filename} headers={excel.headers} rows={excel.rows} />
        {printLink(section)}
      </div>
    );
  }

  // 항목이 많아서 성격별로 구역을 나누고, 각 구역 자체를 드롭다운(기본 숨김)으로
  // 묶음 — 단, 그 구역 안의 항목을 개별 인쇄하는 중이면 그 구역은 열려 있어야
  // 인쇄될 내용이 실제로 화면(DOM)에 존재하게 됨.
  function groupTitle(label: string) {
    return <span className="text-base font-bold text-black">{label}</span>;
  }
  function groupDefaultOpen(keys: string[]) {
    return Boolean(printSection && keys.includes(printSection));
  }

  // 프로젝트별 손익 엑셀용 행 — 화면 표(ProjectProfitTable)와 같은 컬럼 구성.
  const projectExportRows = byProject.map((p) => [
    p.name,
    p.progress_pct ?? 0,
    p.quoteAmount,
    p.sales,
    p.purchase,
    p.profit,
    p.quoteAmount > 0 ? Math.round((p.profit / p.quoteAmount) * 1000) / 10 : 0,
  ]);

  const revenueExportRows = revenueVerificationRows.map((r) => [
    r.name,
    r.siteName ?? "-",
    r.status ?? "-",
    r.quoteAmount,
    r.contractAmount,
    r.ledgerSales,
    r.contractAmount - r.ledgerSales,
  ]);

  const vendorExportRows = byVendor.map((v) => [v.name, v.count, v.amount]);

  const classificationExportRows = classificationPendingRows.map((r) => [
    formatDate(r.date),
    r.type,
    r.clientName,
    r.itemName,
    r.amount,
  ]);

  // 카테고리별 집계 엑셀용 — 화면 표(CategoryAggregateTable)와 같은 매입/대행구매 병합 로직.
  const categoryExportRows = (() => {
    const map = new Map<string, { name: string; count: number; amount: number; agencyCount: number; agencyAmount: number }>();
    for (const r of byCategory) map.set(r.name, { name: r.name, count: r.count, amount: r.amount, agencyCount: 0, agencyAmount: 0 });
    for (const a of agencyByCategory) {
      const existing = map.get(a.name);
      if (existing) {
        existing.agencyCount = a.count;
        existing.agencyAmount = a.amount;
      } else {
        map.set(a.name, { name: a.name, count: 0, amount: 0, agencyCount: a.count, agencyAmount: a.amount });
      }
    }
    return Array.from(map.values()).map((r) => [r.name, r.count, r.amount, r.agencyCount, r.agencyAmount]);
  })();

  const customerExportRows = byCustomer.map((v) => [v.name, v.count, v.amount]);

  const workLogExportRows = workLogSummary.map((r) => [r.siteName, r.title, r.days, r.dates.join(", ")]);

  const unassignedExportRows = unassignedRows.map((r) => [formatDate(r.date), r.siteName, r.title]);

  const aiSummary = {
    year: selectedYear,
    yearTotalSales: yearTotal.sales,
    yearTotalPurchase: yearTotal.purchase,
    monthly: monthly.map((m) => ({ month: m.label, sales: m.sales, purchase: m.purchase, profit: m.profit })),
    projectSummary,
    bySite: bySite.slice(0, 8).map((s) => ({ site: s.name, sales: s.sales, purchase: s.purchase, profit: s.profit })),
    topVendors: byVendor.slice(0, 5).map((v) => ({ vendor: v.name, count: v.count, amount: v.amount })),
    topCustomers: byCustomer.slice(0, 5).map((v) => ({ customer: v.name, count: v.count, amount: v.amount })),
  };

  return (
    <div className="space-y-6">
      {isolate && <AutoPrint cleanupHref={reportUrl()} />}

      <div className={popupOpen || isolate ? "space-y-6 print:hidden" : "space-y-6"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">보고서</h1>
          <YearFilter basePath="/reports" years={years} selectedYear={selectedYear} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">{selectedYear}년 총 매출액</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatWon(yearTotal.sales)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{selectedYear}년 총 매입액</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatWon(yearTotal.purchase)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{selectedYear}년 순손익</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
                {formatWon(yearTotal.sales - yearTotal.purchase)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleSection
        title={groupTitle("재무 개요")}
        bare
        defaultOpen={groupDefaultOpen(["quarterly", "monthly", "bySite"])}
      >
       <div className="space-y-6 mt-3">
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${hiddenClass("quarterly")}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">분기별 매입·매출·손익</h2>
            {sectionControls("quarterly", {
              filename: `분기별_매입매출손익_${selectedYear}.xlsx`,
              headers: ["분기", "매출", "매입", "손익"],
              rows: quarterly.map((q) => [q.label, q.sales, q.purchase, q.profit]),
            })}
          </div>
          <SimpleTable
            rows={quarterly.map((q) => [q.label, formatWon(q.sales), formatWon(q.purchase), formatWon(q.profit)])}
            headers={["분기", "매출", "매입", "손익"]}
          />
        </div>

        <CollapsibleSection
          title="월별 매입·매출·손익"
          className={hiddenClass("monthly")}
          defaultOpen={printSection === "monthly"}
          headerExtra={sectionControls("monthly", {
            filename: `월별_매입매출손익_${selectedYear}.xlsx`,
            headers: ["월", "매출", "매입", "손익"],
            rows: monthly.map((m) => [m.label, m.sales, m.purchase, m.profit]),
          })}
        >
          <SimpleTable
            rows={monthly.map((m) => [m.label, formatWon(m.sales), formatWon(m.purchase), formatWon(m.profit)])}
            headers={["월", "매출", "매입", "손익"]}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="현장별 손익 — 어느 현장에서 얼마를 벌고 썼는지"
          className={hiddenClass("bySite")}
          defaultOpen={printSection === "bySite"}
          headerExtra={sectionControls("bySite", {
            filename: `현장별_손익_${selectedYear}.xlsx`,
            headers: ["현장", "매출", "매입", "손익"],
            rows: bySite.map((s) => [s.name, s.sales, s.purchase, s.profit]),
          })}
        >
          <SimpleTable
            rows={bySite.map((s) => [s.name, formatWon(s.sales), formatWon(s.purchase), formatWon(s.profit)])}
            headers={["현장", "매출", "매입", "손익"]}
            empty="현장 데이터가 없습니다."
          />
        </CollapsibleSection>
       </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={groupTitle("프로젝트")}
        bare
        defaultOpen={groupDefaultOpen(["projects", "revenue"])}
      >
       <div className="space-y-6 mt-3">

        <CollapsibleSection
          className={hiddenClass("projects")}
          title="프로젝트별 손익 (클릭하면 발주금 대비 상세 손익)"
          defaultOpen={printSection === "projects"}
          headerExtra={sectionControls(
            "projects",
            {
              filename: `프로젝트별_손익_${selectedYear}.xlsx`,
              headers: ["프로젝트", "진행률", "발주액", "매출", "매입", "이익금", "이익율"],
              rows: projectExportRows,
            },
            <>
              <span className="text-xs text-slate-500">
                {selectedYear}년 총 {projectSummary.count}건 · 매출 {formatWon(projectSummary.sales)} · 매입{" "}
                {formatWon(projectSummary.purchase)} · 이익금 {formatWon(projectSummary.profit)} · 이익율{" "}
                {projectSummary.profitRate === null ? "-" : `${projectSummary.profitRate.toFixed(2)}%`}
              </span>
              {projectSiteOptions.length > 0 && (
                <ReportProjectSiteFilter year={selectedYear} siteOptions={projectSiteOptions} selectedSite={site} />
              )}
              {byProject.length > 0 && (
                <ReportProjectPicker
                  year={selectedYear}
                  site={site}
                  projects={[...byProject].sort((a, b) => a.name.localeCompare(b.name, "ko"))}
                />
              )}
            </>
          )}
        >
          <p className="mb-3 hidden text-xs text-slate-500 print:block">
            {selectedYear}년 총 {projectSummary.count}건 · 매출 {formatWon(projectSummary.sales)} · 매입{" "}
            {formatWon(projectSummary.purchase)} · 이익금 {formatWon(projectSummary.profit)} · 이익율{" "}
            {projectSummary.profitRate === null ? "-" : `${projectSummary.profitRate.toFixed(2)}%`}
          </p>

          <div className="mb-4 grid grid-cols-2 gap-4 print:mb-2 print:gap-2 print:break-inside-avoid">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
              <p className="text-sm text-slate-500 print:text-xs">총 발주액</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 print:text-lg">
                {formatWon(projectSummary.quoteAmount)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
              <p className="text-sm text-slate-500 print:text-xs">총 이익금</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 print:text-lg">
                {formatWon(projectSummary.profit)}
              </p>
            </div>
          </div>

          <ProjectProfitTable rows={byProject} year={selectedYear} site={site} />
      </CollapsibleSection>

      <CollapsibleSection
        title="매출 검증 — 수주액 vs 실제 매출 원장"
        className={hiddenClass("revenue")}
        defaultOpen={printSection === "revenue"}
        headerExtra={sectionControls("revenue", {
          filename: `매출검증_${selectedYear}.xlsx`,
          headers: ["프로젝트명", "현장", "상태", "발주액", "수주액(실수령액)", "실제 매출 원장", "차이"],
          rows: revenueExportRows,
        })}
      >
        <RevenueVerificationTable rows={revenueVerificationRows} />
        </CollapsibleSection>
       </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={groupTitle("거래처·카테고리 집계")}
        bare
        defaultOpen={groupDefaultOpen(["vendors", "classification", "categories", "customers"])}
      >
       <div className="space-y-6 mt-3">
        <CollapsibleSection
          title="매입처별 집계 — 어느 업체에서 얼마를 매입했는지"
          className={hiddenClass("vendors")}
          defaultOpen={printSection === "vendors"}
          headerExtra={sectionControls(
            "vendors",
            { filename: `매입처별_집계_${selectedYear}.xlsx`, headers: ["거래처", "건수", "매입 합계"], rows: vendorExportRows },
            <VendorAgencyToggle checked={includeVendorAgency} />
          )}
        >
          <VendorAggregateTable rows={byVendor} year={selectedYear} vendorAgency={includeVendorAgency} />
        </CollapsibleSection>

        <CollapsibleSection
          title={`프로젝트 분류 대기 중 — ${classificationPendingRows.length}건`}
          className={hiddenClass("classification")}
          defaultOpen={printSection === "classification"}
          headerExtra={sectionControls("classification", {
            filename: `프로젝트_분류_대기중_${selectedYear}.xlsx`,
            headers: ["날짜", "구분", "거래처", "품목", "금액"],
            rows: classificationExportRows,
          })}
        >
          <ClassificationPendingTable rows={classificationPendingRows} />
        </CollapsibleSection>

        <CollapsibleSection
          title="카테고리별 집계 — 어느 카테고리에 얼마를 매입했는지"
          className={hiddenClass("categories")}
          defaultOpen={printSection === "categories"}
          headerExtra={sectionControls("categories", {
            filename: `카테고리별_집계_${selectedYear}.xlsx`,
            headers: ["카테고리", "매입 건수", "매입 합계", "대행구매 건수", "대행구매액 (프로젝트)"],
            rows: categoryExportRows,
          })}
        >
          <CategoryAggregateTable rows={byCategory} agencyRows={agencyByCategory} year={selectedYear} />
        </CollapsibleSection>

        <CollapsibleSection
          title="매출처별 집계"
          className={hiddenClass("customers")}
          defaultOpen={printSection === "customers"}
          headerExtra={sectionControls("customers", {
            filename: `매출처별_집계_${selectedYear}.xlsx`,
            headers: ["거래처", "건수", "매출 합계"],
            rows: customerExportRows,
          })}
        >
          <SimpleTable
            rows={byCustomer.map((v) => [v.name, `${v.count}건`, formatWon(v.amount)])}
            headers={["거래처", "건수", "매출 합계"]}
            empty="매출 거래가 없습니다."
          />
        </CollapsibleSection>
       </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={groupTitle("작업일지")}
        bare
        defaultOpen={groupDefaultOpen(["worklog", "unassigned"])}
      >
       <div className="space-y-6 mt-3">

        <CollapsibleSection
        className={hiddenClass("worklog")}
        title={`작업일지 집계 — ${selectedYear}년 ${wlMonthRange.label} 동안 같은 작업을 몇 일 했는지`}
        defaultOpen={printSection === "worklog"}
        headerExtra={sectionControls(
          "worklog",
          { filename: `작업일지_집계_${selectedYear}.xlsx`, headers: ["현장", "내용", "일수", "날짜"], rows: workLogExportRows },
          <>
            <span className="text-xs text-slate-500">총 {workLogTotalDays}일</span>
            {wlSites && wlSites.length > 0 && (
              <WorkLogSiteFilter siteOptions={wlSites.map((s) => ({ value: s.id, label: s.name }))} selectedSite={wlSite} />
            )}
            <WorkLogMonthRangeFilter value={wlMonths ?? "1-12"} />
          </>
        )}
      >
        <p className="mb-2 hidden text-xs text-slate-500 print:block">총 {workLogTotalDays}일</p>
        <WorkLogSummaryTable
          rows={workLogSummary}
          emptyMessage="이 기간에 현장이 지정된 작업일지가 없습니다."
          year={selectedYear}
          initialChecked={(wlChecks ?? []).map((c) => c.group_key)}
        />
      </CollapsibleSection>

      <CollapsibleSection
        className={hiddenClass("unassigned")}
        title="작업일지 - 프로젝트 미선정 (현장은 골랐지만 프로젝트 연결 안 된 항목)"
        defaultOpen={printSection === "unassigned"}
        headerExtra={sectionControls(
          "unassigned",
          { filename: `작업일지_미선정_${selectedYear}.xlsx`, headers: ["날짜", "현장", "제목"], rows: unassignedExportRows },
          <>
            <span className="text-xs text-slate-500">총 {unassignedDayCount}일</span>
            <UnassignedWorkLogMonthFilter value={unassignedMonth} />
          </>
        )}
      >
        <UnassignedWorkLogTable rows={unassignedRows} emptyMessage="이 기간에 미선정 항목이 없습니다." />
        </CollapsibleSection>
       </div>
      </CollapsibleSection>

      <ReportAIInsights
        summary={aiSummary}
        savedInsights={(savedInsights ?? []) as unknown as ReportAiInsight[]}
        saveAction={saveReportAiInsight}
        deleteAction={deleteReportAiInsight}
      />

      {project && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <ProjectProfitReport projectId={project} closeHref={`/reports?year=${selectedYear}${site ? `&site=${site}` : ""}`} />
          </div>
        </div>
      )}

      {vendor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <VendorDetailReport
              vendorName={vendor}
              year={selectedYear}
              rows={vendorAllRows}
              closeHref={`/reports?year=${selectedYear}${includeVendorAgency ? "&vendorAgency=1" : ""}`}
              vendorAgency={includeVendorAgency}
            />
          </div>
        </div>
      )}

      {category && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <CategoryDetailReport
              categoryName={category}
              year={selectedYear}
              purchaseRows={categoryPurchaseRows}
              agencyRows={categoryAgencyRows}
              categories={expenseCategories ?? []}
              clientNames={clientNames}
              closeHref={`/reports?year=${selectedYear}${site ? `&site=${site}` : ""}`}
            />
          </div>
        </div>
      )}

      <TransactionEditPopup
        editTx={editTx}
        redirectTo={
          category
            ? `/reports?year=${selectedYear}&category=${encodeURIComponent(category)}`
            : `/reports?year=${selectedYear}${includeVendorAgency ? "&vendorAgency=1" : ""}&vendor=${encodeURIComponent(vendor ?? "")}`
        }
      />
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  empty = "데이터가 없습니다.",
}: {
  headers: string[];
  rows: string[][];
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {headers.map((h, i) => (
              <th key={h} className={`pb-2 pr-4 ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={`py-2 pr-4 ${j > 0 ? "text-right font-mono text-slate-700" : "text-slate-700"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="py-8 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
