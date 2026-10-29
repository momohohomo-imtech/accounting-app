import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment, ExpenseCategory, Transaction } from "@/lib/types";
import { formatWon, formatDate } from "@/lib/format";
import { projectStatusLabel } from "@/lib/projectStatus";
import { fetchAllRowsIn } from "@/lib/supabaseFetchAll";
import { purchaseCostOf } from "@/lib/vatBasis";
import { resolveCategoryColor } from "@/lib/categoryColor";
import { unsettledCreditPurchase } from "@/lib/projectProfit";
import { billedSalesByProject, projectReceipts, receivableOf, receivedSalesByProject } from "@/lib/expectedReceivable";
import { listTotals, listUnits, unitAmounts } from "@/lib/projectListTotals";
import {
  formatHeadcount,
  formatWorkDays,
  headcountForProjects,
  tripTotals,
  workDaySplitForProjects,
  workLogContentsByProjectDate,
  type TripDayRow,
} from "@/lib/tripLog";
import type { WorkLogTitleRow } from "@/lib/workLogSummary";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EscapeCloseLink } from "@/components/EscapeCloseLink";
import { ProjectPurchaseTable } from "@/components/ProjectPurchaseTable";
import { ProjectReceiptsTable } from "@/components/ProjectReceiptsTable";
import { ProjectTripDetailTable } from "@/components/ProjectTripDetailTable";
import {
  CombinedAgencyTable,
  CombinedCategorySection,
  ProjectsCombinedTable,
  type CombinedCategoryRow,
  type CombinedUnitRow,
} from "@/components/ProjectsCombinedReportTables";
import { ProjectsCombinedReportActions } from "@/components/ProjectsCombinedReportActions";

export type CombinedReportProject = {
  id: string;
  project_code: string | null;
  name: string;
  status: string | null;
  parent_project_id: string | null;
  quote_amount: number | null;
  site_name?: string | null;
};

type CategoryRel = Pick<ExpenseCategory, "name" | "project_only" | "color"> & Partial<ExpenseCategory>;
type PurchaseRow = Pick<
  Transaction,
  | "id"
  | "trans_date"
  | "type"
  | "payment_type"
  | "project_id"
  | "item_name"
  | "client_name_raw"
  | "sales_amount"
  | "sales_vat"
  | "purchase_amount"
  | "purchase_vat"
  | "tax_invoice_issued"
> & {
  clients: { name: string } | { name: string }[] | null;
  expense_categories: CategoryRel | CategoryRel[] | null;
};
type AgencyRow = {
  id: string;
  project_id: string;
  item_name: string | null;
  amount: number;
  client_name: string | null;
  memo: string | null;
  expense_categories: CategoryRel | CategoryRel[] | null;
};

const TX_COLUMNS =
  "id, trans_date, type, payment_type, project_id, item_name, client_name_raw, sales_amount, sales_vat, purchase_amount, purchase_vat, tax_invoice_issued, clients(name), expense_categories(*)";
const RECEIPT_STATUS_LABEL = { received: "입금 완료", partial: "일부 입금", waiting: "입금 대기" } as const;
const round2 = (v: number) => Math.round(v * 100) / 100;

function addTo(map: Map<string, number>, key: string | null, amount: number) {
  if (key) map.set(key, (map.get(key) ?? 0) + amount);
}

// 통합 보고서 — 프로젝트 목록에서 지금 필터(연도·현장·상태)로 보이는 그 해 프로젝트 전부(묶음 때문에 함께 보이는 귀속 하위
// 포함)를 합친 보고서. 요약·프로젝트별 표는 목록 하단 합계와 같은 계산(lib/projectListTotals.ts — 귀속 묶음은 한 단위),
// 매입·대행구매·받은 돈·출장 내역은 프로젝트 보고서와 같은 기준으로 모아 보여 줌. 읽기 전용(수정은 각 프로젝트 보고서에서).
export async function ProjectsCombinedReport({
  year,
  siteLabel,
  statusLabels,
  projects,
  topOf,
  broughtInCount,
  otherYearCount,
  listHref,
}: {
  year: number;
  siteLabel: string | null;
  statusLabels: string[];
  projects: CombinedReportProject[];
  /** 하위 id → 목록에 보이는 묶음 어미 id(프로젝트 목록의 groupTopOf) */
  topOf: Map<string, string>;
  /** 필터에는 안 걸렸지만 묶음 때문에 함께 들어간 하위 수 */
  broughtInCount: number;
  /** 묶음에 보이기만 하고 합계에서 빠진 다른 해 하위 수 */
  otherYearCount: number;
  listHref: string;
}) {
  const supabase = await createClient();
  const ids = projects.map((p) => p.id);
  // 프로젝트가 수백 개여도 요청 주소가 너무 길어지지 않게 나눠 조회(fetchAllRowsIn). 서로 기다릴 필요가 없어 한꺼번에.
  const [txRows, agencyRows, workLogRows, tripDayRows] = ids.length
    ? await Promise.all([
        fetchAllRowsIn<PurchaseRow>(ids, (chunk, from, to) =>
          supabase
            .from("transactions")
            .select(TX_COLUMNS)
            .in("project_id", chunk)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsIn<AgencyRow>(ids, (chunk, from, to) =>
          supabase
            .from("project_agency_purchases")
            .select("id, project_id, item_name, amount, client_name, memo, expense_categories(name, project_only, color)")
            .in("project_id", chunk)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsIn<WorkLogTitleRow>(ids, (chunk, from, to) =>
          supabase
            .from("work_logs")
            .select("log_date, site_id, project_id, title, sort_order, projects(name)")
            .in("project_id", chunk)
            .order("id", { ascending: true })
            .range(from, to)
        ),
        // 출장 날짜 줄 — 090 SQL 전이라 표가 없으면 null(출장 0일, 출장 투입 인원 "-").
        fetchAllRowsIn<TripDayRow>(ids, (chunk, from, to) =>
          supabase
            .from("trip_log_days")
            .select("id, project_id, work_date, staff_count, helper_count, equipment_used, equipment_place, equipment_hours, note")
            .in("project_id", chunk)
            .order("id", { ascending: true })
            .range(from, to)
        ).catch(() => null),
      ])
    : [[] as PurchaseRow[], [] as AgencyRow[], [] as WorkLogTitleRow[], null];

  const byDate = (a: PurchaseRow, b: PurchaseRow) => a.trans_date.localeCompare(b.trans_date) || a.id.localeCompare(b.id);
  const purchaseRowsRaw = txRows.filter((t) => t.type === "매입").sort(byDate);
  const salesRowsRaw = txRows.filter((t) => t.type === "매출").sort(byDate);
  // 외상 정산 이력은 이 프로젝트들의 외상 거래 것만.
  const creditIds = txRows.filter((t) => t.payment_type === "credit").map((t) => t.id);
  const creditPayments = creditIds.length
    ? await fetchAllRowsIn<CreditPayment>(creditIds, (chunk, from, to) =>
        supabase
          .from("credit_payments")
          .select("*")
          .in("transaction_id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
      )
    : [];

  // 프로젝트 목록과 같은 기준 — 매입은 공급가(부가세 제외), 외상(미완납)은 완납 전까지 빠짐.
  const purchaseRows = purchaseRowsRaw.filter((t) => isLedgerVisible(t, creditPayments));
  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseRows) addTo(purchaseByProject, t.project_id, purchaseCostOf(t));
  const agencyByProject = new Map<string, number>();
  for (const a of agencyRows) addTo(agencyByProject, a.project_id, a.amount);
  const receivedByProject = receivedSalesByProject(salesRowsRaw, creditPayments);
  const billedByProject = billedSalesByProject(salesRowsRaw);

  const units = listUnits(projects, topOf);
  const totals = listTotals(units, purchaseByProject, agencyByProject, receivedByProject);

  // 외상 미정산 매입 — 요약에 따로(매입 합계·이익금 미포함), "이익금 − 외상 미정산분"은 이익금을 계산한(발주액 있는) 단위 것만.
  const unsettled = unsettledCreditPurchase(purchaseRowsRaw, creditPayments);
  const profitIds = new Set(
    units
      .filter((u) => u.reduce((sum, p) => sum + (p.quote_amount ?? 0), 0) !== 0)
      .flat()
      .map((p) => p.id)
  );
  const unsettledInProfit = unsettledCreditPurchase(
    purchaseRowsRaw.filter((t) => t.project_id && profitIds.has(t.project_id)),
    creditPayments
  );
  // 남은 금액을 입금 대기(계산서 발행 후 아직 못 받은 것)·계산서 미발행으로 나눔 — 남은 금액에 들어간 단위만.
  let waiting = 0;
  let unbilled = 0;
  for (const u of units) {
    const r = receivableOf(u, agencyByProject, receivedByProject, billedByProject);
    if (r && r.quote > 0) {
      waiting += r.waiting;
      unbilled += r.unbilled;
    }
  }
  const receipts = projectReceipts(salesRowsRaw, creditPayments, totals.quote, totals.agency);

  const labelOf = (p: CombinedReportProject) => (p.project_code ? `${p.project_code} ${p.name}` : p.name);
  const projectLabelById = new Map(projects.map((p) => [p.id, labelOf(p)]));
  const projectLabelOf = (id: string | null) => (id ? projectLabelById.get(id) ?? "" : "");

  const unitRows: CombinedUnitRow[] = units
    .map((members) => {
      const lead = members[0];
      const a = unitAmounts(members, purchaseByProject, agencyByProject, receivedByProject);
      return {
        id: lead.id,
        code: lead.project_code ?? "",
        name: lead.name,
        extraCount: members.length - 1,
        memberLabels: members.map(labelOf).join(", "),
        site: lead.site_name ?? "-",
        status: projectStatusLabel(lead.status),
        ...a,
        // 묶음은 합산 보고서, 하나면 그 프로젝트만(own=1 — 다른 해 하위가 있어도 이 줄과 같은 금액).
        href: `${listHref}&report=${lead.id}${members.length > 1 ? "" : "&own=1"}&back=combined`,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name, "ko"));

  const categoryMap = new Map<string, CombinedCategoryRow>();
  const addCategory = (category: CategoryRel | null | undefined, amount: number) => {
    const name = category?.name ?? "미분류";
    const entry = categoryMap.get(name) ?? { name, amount: 0, color: category ? resolveCategoryColor(category) : undefined };
    entry.amount += amount;
    categoryMap.set(name, entry);
  };
  for (const t of purchaseRows) addCategory(one(t.expense_categories), purchaseCostOf(t));
  for (const a of agencyRows) addCategory(one(a.expense_categories), a.amount);
  const categoryRows = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  const purchaseTableRows = purchaseRowsRaw.map((t) => {
    const category = one(t.expense_categories);
    return {
      id: t.id,
      date: t.trans_date,
      project: projectLabelOf(t.project_id),
      vendor: one(t.clients)?.name ?? t.client_name_raw ?? "-",
      item: t.item_name ?? "-",
      category: category?.name ?? "미분류",
      categoryColor: category ? resolveCategoryColor(category) : undefined,
      amount: t.purchase_amount + t.purchase_vat,
      unsettled: !isLedgerVisible(t, creditPayments),
    };
  });
  const agencyTableRows = agencyRows
    .map((a) => {
      const category = one(a.expense_categories);
      return {
        id: a.id,
        project: projectLabelOf(a.project_id),
        client: a.client_name ?? "-",
        item: a.item_name ?? "-",
        category: category?.name ?? "미분류",
        categoryColor: category ? resolveCategoryColor(category) : undefined,
        amount: a.amount,
        memo: a.memo ?? "",
      };
    })
    .sort((a, b) => a.project.localeCompare(b.project, "ko"));
  const receiptRows = receipts.lines.map((l) => ({
    id: l.row.id,
    date: l.row.trans_date,
    item: l.row.item_name ?? "-",
    projectLabel: projectLabelOf(l.row.project_id),
    client: one(l.row.clients)?.name ?? l.row.client_name_raw ?? "-",
    total: l.total,
    received: l.received,
    status: l.status,
    paidDate: l.paidDate,
    taxInvoice: Boolean(l.row.tax_invoice_issued),
  }));

  // 근무일수는 날짜 기준(같은 날 여러 프로젝트를 했어도 하루), 출장 투입 인원은 출장 날짜 줄마다 적은 인원 합.
  const workDays = workDaySplitForProjects(workLogRows, tripDayRows, ids);
  const headcount = headcountForProjects(tripDayRows, ids);
  const contentsByKey = workLogContentsByProjectDate(workLogRows);
  const tripDetailRows = (tripDayRows ?? [])
    .map((d) => ({
      ...d,
      contents: contentsByKey.get(`${d.project_id}|${d.work_date}`) ?? "",
      projectLabel: projectLabelOf(d.project_id),
    }))
    .sort((a, b) => a.work_date.localeCompare(b.work_date) || a.projectLabel.localeCompare(b.projectLabel));
  const tripDetailTotals = tripTotals(tripDetailRows);

  const title = `${year}년 프로젝트 통합 보고서`;
  const filterCount =
    broughtInCount > 0 ? ` (필터된 ${projects.length - broughtInCount}건 + 묶음 하위 ${broughtInCount}건)` : "";
  const infoLines = [
    `현장: ${siteLabel ?? "전체"}    상태: ${statusLabels.length > 0 ? statusLabels.join(", ") : "전체"}`,
    `프로젝트 ${projects.length}건${filterCount}${otherYearCount > 0 ? ` · 다른 해 하위 ${otherYearCount}건 제외` : ""}`,
    `근무일수: ${formatWorkDays(workDays)} (같은 날은 하루로)`,
    `출장 투입 인원: ${formatHeadcount(headcount)}`,
  ];
  const profitLabel = formatWon(totals.profit);
  const rateLabel = totals.rate === null ? "-" : `${totals.rate.toFixed(2)}%`;
  const summaryRows: [string, string][] = [
    ["발주액 (원청 발주금액)", formatWon(totals.quote)],
    ["대행구매액", `-${formatWon(totals.agency)}`],
    ["수주예상액 (발주액 − 대행구매액)", formatWon(totals.contractExpected)],
    ["매입 합계 (부가세 제외)", `-${formatWon(totals.purchase)}`],
    ...(unsettled.count > 0
      ? ([[`외상 미정산분 (부가세 제외, ${unsettled.count}건, 매입 합계 미포함)`, `-${formatWon(unsettled.cost)}`]] as [string, string][])
      : []),
    ["이익금", profitLabel],
    ...(totals.noQuoteCount > 0
      ? ([[`발주액 미입력 ${totals.noQuoteCount}건 매입·대행구매 (이익금 미포함)`, `-${formatWon(totals.noQuoteCost)}`]] as [string, string][])
      : []),
    ...(unsettledInProfit.count > 0
      ? ([["이익금 − 외상 미정산분", formatWon(totals.profit - unsettledInProfit.cost)]] as [string, string][])
      : []),
    ["이익율", rateLabel],
    ["받은 금액 (부가세 제외)", formatWon(totals.received)],
    ["남은 금액 (받을 금액, 부가세 제외)", formatWon(totals.receivable)],
  ];

  const cell = "min-w-0";
  const label = "text-xs text-slate-500 print:text-[9px]";
  const value = "tabular-nums text-sm font-bold whitespace-nowrap print:text-xs";
  const note = "mt-0.5 text-[11px] text-slate-400 print:text-[8px]";

  return (
    <div className="flex flex-col gap-4 print:gap-2 print:text-[11px] print:leading-snug">
      <EscapeCloseLink href={listHref} />
      <div className="flex flex-wrap items-start justify-between gap-2 md:flex-nowrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900 print:text-base">{title}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 print:text-[10px]">
            {infoLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        {/* flex-wrap: 휴대폰에서 버튼이 한 줄에 다 안 들어가도 "닫기"가 화면 밖으로 잘리지 않게 */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
          <ProjectsCombinedReportActions
            filename={`${year}년_프로젝트_통합보고서`}
            title={title}
            infoLines={infoLines}
            unitRows={unitRows.map((r) => [
              r.code || "-",
              r.extraCount > 0 ? `${r.name} 외 ${r.extraCount}건` : r.name,
              r.site,
              r.status,
              r.quote,
              r.agency,
              r.purchase,
              r.profit ?? "발주액 미입력",
              r.rate === null ? "" : round2(r.rate),
              r.received,
              r.receivable ?? "",
            ])}
            totalRow={[
              "합계",
              `${unitRows.length}건`,
              "",
              "",
              totals.quote,
              totals.agency,
              totals.purchase,
              totals.profit,
              totals.rate === null ? "" : round2(totals.rate),
              totals.received,
              totals.receivable,
            ]}
            summaryRows={summaryRows}
            purchaseRows={purchaseTableRows.map((r) => [
              formatDate(r.date),
              r.project,
              r.vendor,
              r.item,
              r.category,
              r.amount,
              r.unsettled ? "외상 미정산(매입 합계 미포함)" : "",
            ])}
            agencyRows={agencyTableRows.map((r) => [r.project, r.client, r.item, r.category, r.amount, r.memo])}
            receiptRows={receiptRows.map((r) => [
              formatDate(r.date),
              r.projectLabel,
              r.client,
              r.item,
              r.total,
              r.received,
              RECEIPT_STATUS_LABEL[r.status],
              r.paidDate ? formatDate(r.paidDate) : "",
            ])}
          />
          <Link href={listHref} scroll={false} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">지금 필터에 맞는 프로젝트가 없습니다.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 min-[480px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 print:grid-cols-4 print:gap-2 print:border-b print:pt-2 print:pb-2 print:break-inside-avoid">
            <div className={cell}>
              <p className={label}>발주액 (원청 발주금액)</p>
              <p className={`${value} text-slate-900`}>{formatWon(totals.quote)}</p>
            </div>
            <div className={cell}>
              <p className={label}>대행구매액</p>
              <p className={`${value} text-slate-500`}>-{formatWon(totals.agency)}</p>
            </div>
            <div className={cell}>
              <p className={label}>수주예상액 (발주액 − 대행구매액)</p>
              <p className={`${value} text-slate-900`}>{formatWon(totals.contractExpected)}</p>
            </div>
            <div className={cell}>
              <p className={label}>매입 합계 (부가세 제외)</p>
              <p className={`${value} text-slate-500`}>-{formatWon(totals.purchase)}</p>
            </div>
            {unsettled.count > 0 && (
              <div className={cell}>
                <p className={label}>외상 미정산분 (부가세 제외)</p>
                <p className={`${value} text-slate-500`}>-{formatWon(unsettled.cost)}</p>
                <p className={note}>{unsettled.count}건 · 매입 합계·이익금 미포함</p>
              </div>
            )}
            <div className={cell}>
              <p className={label}>이익금</p>
              <p className={`${value} ${totals.profit >= 0 ? "text-slate-900" : "text-red-600"}`}>{profitLabel}</p>
              {totals.noQuoteCount > 0 && (
                <p className={note}>
                  발주액 미입력 {totals.noQuoteCount}건(매입·대행구매 {formatWon(totals.noQuoteCost)}) 제외
                </p>
              )}
              {unsettledInProfit.count > 0 && (
                <div className="mt-0.5 text-yellow-600">
                  <p className="text-[11px] leading-tight print:text-[8px]">− 외상 미정산분</p>
                  <p className={value}>{formatWon(totals.profit - unsettledInProfit.cost)}</p>
                </div>
              )}
            </div>
            <div className={cell}>
              <p className={label}>이익율</p>
              <p className={`${value} ${totals.rate === null ? "text-slate-400" : totals.rate >= 0 ? "text-slate-900" : "text-red-600"}`}>
                {rateLabel}
              </p>
            </div>
            <div className={cell}>
              <p className={label}>받은 금액 (부가세 제외)</p>
              <p className={`${value} text-slate-900`}>{formatWon(totals.received)}</p>
              <p className={note}>실제 입금 {formatWon(receipts.receivedActual)} (부가세 포함)</p>
            </div>
            <div className={cell}>
              <p className={label}>남은 금액 (받을 금액, 부가세 제외)</p>
              <p className={`${value} text-slate-900`}>{formatWon(totals.receivable)}</p>
              <p className={note}>
                입금 대기 {formatWon(waiting)} · 계산서 미발행 {formatWon(unbilled)}
              </p>
            </div>
          </div>

          <section className="space-y-2 print:break-inside-avoid">
            <h3 className="text-sm font-semibold text-slate-900">
              프로젝트별 <span className="text-xs font-normal text-slate-500">(단위: 원, 매입·이익금은 부가세 제외)</span>
            </h3>
            <ProjectsCombinedTable
              rows={unitRows}
              totals={{
                quote: totals.quote,
                agency: totals.agency,
                purchase: totals.purchase,
                profit: totals.profit,
                rate: totals.rate,
                received: totals.received,
                receivable: totals.receivable,
              }}
            />
            <p className="text-xs text-slate-500 print:text-[9px]">
              프로젝트 이름을 누르면 그 프로젝트 보고서(귀속 묶음은 합산 보고서)가 열립니다. 합계는 프로젝트 목록 하단 합계와 같은
              계산입니다(그 해 프로젝트만, 귀속 묶음은 어미 + 귀속 하위를 한 단위로). 매입·이익금은 발주액과 같은 부가세 제외 기준이고,
              외상 미정산 매입은 정산 전까지 매입 합계·이익금에 넣지 않습니다. 남은 금액은 진행중·공사 완료·완료 수금대기만 계산합니다.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">카테고리별 지출 (매입 + 대행구매, 부가세 제외)</h3>
            <CombinedCategorySection rows={categoryRows} quoteTotal={totals.quote} />
          </section>

          {/* 내역은 기본 접힘 — 펼친 채로 인쇄하면 같이 나옴(늘 넣으면 프로젝트가 많을 때 인쇄가 길어짐). */}
          <CollapsibleSection title={`매입내역 (${purchaseTableRows.length}건)`} bare>
            <div className="space-y-2">
              <ProjectPurchaseTable rows={purchaseTableRows} showProject />
              {unsettled.count > 0 && (
                <p className="text-xs text-amber-600">
                  &quot;외상 미정산&quot; 항목은 참고용 표시이며, 정산 전까지 매입 합계·이익금 계산에는 포함되지 않습니다.
                </p>
              )}
            </div>
          </CollapsibleSection>

          {agencyTableRows.length > 0 && (
            <CollapsibleSection title={`대행구매 내역 (${agencyTableRows.length}건)`} bare>
              <div className="space-y-2">
                <CombinedAgencyTable rows={agencyTableRows} />
                <p className="text-xs text-slate-500">대행구매 추가·수정은 각 프로젝트 보고서에서 합니다.</p>
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title={`받은 돈 내역 (선급금·중도금·잔금 계산서 ${receiptRows.length}건)`} bare>
            {receiptRows.length > 0 ? (
              <div className="space-y-2">
                <ProjectReceiptsTable rows={receiptRows} showProject />
                <p className="text-xs text-slate-500 print:text-[9px]">
                  받은 돈·계산서 금액은 부가세 포함. 위 요약의 받은 금액·남은 금액은 발주액과 같은 부가세 제외 기준입니다. 일부만
                  입금된 계산서는 다 받을 때까지 받은 금액에 넣지 않습니다.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">이 프로젝트들로 등록된 매출(계산서)이 없습니다.</p>
            )}
          </CollapsibleSection>

          {tripDetailRows.length > 0 && (
            <CollapsibleSection
              title={`출장 내역 (${tripDetailTotals.days}일${tripDetailTotals.people ? ` · 연인원 ${tripDetailTotals.people}명` : ""})`}
              bare
            >
              <ProjectTripDetailTable rows={tripDetailRows} showProject />
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
}
