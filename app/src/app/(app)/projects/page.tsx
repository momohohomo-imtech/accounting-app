import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { isLedgerVisible } from "@/lib/credit";
import type { CreditPayment } from "@/lib/types";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createProjectRecord, updateProjectRecord, deleteProjectRecord } from "@/lib/actions/projects";
import type { FieldConfig, RowBgColor } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { SitesSection } from "@/components/sections/SitesSection";
import { QuotesSection } from "@/components/sections/QuotesSection";
import { PurchaseOrdersSection } from "@/components/sections/PurchaseOrdersSection";
import { YearFilter } from "@/components/YearFilter";
import { ProjectProfitReport } from "@/components/ProjectProfitReport";
import { LinkButton } from "@/components/ui/Button";
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_AWAITING_PAYMENT } from "@/lib/projectStatus";
import { formatWon } from "@/lib/format";
import { ProjectListExportButtons } from "@/components/ProjectListExportButtons";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ProjectsPageMemo } from "@/components/ProjectsPageMemo";

const TABS = [
  { key: "list", label: "프로젝트" },
  { key: "sites", label: "현장 / 거래처" },
  { key: "quotes", label: "견적서" },
  { key: "purchase_orders", label: "발주서" },
];

// 프로젝트 목록 행 배경색 — 상태 기준: 진행중 옅은 빨강, 완료 수금대기 파랑, 공사 완료 녹색,
// 검토중/기타 옅은 회색. 타 프로젝트 귀속 행은 자기 상태색 대신 귀속 대상(부모) 프로젝트의
// 상태색을 그대로 물려받는다(부모와 같은 배경으로 묶여 보이게).
function statusRowColor(status: string | null | undefined): RowBgColor | undefined {
  if (status === "done") return "green";
  if (status === "review" || status === "etc") return "gray";
  if (status === "ongoing") return "red";
  if (status === PROJECT_STATUS_AWAITING_PAYMENT) return "blue";
  return undefined;
}
// rowColorKey 필드는 색상 이름을 그대로 값으로 쓰므로(예: "green" → "green") 항등 매핑이면 충분.
const ROW_COLOR_IDENTITY_MAP: Record<string, RowBgColor> = Object.fromEntries(
  (["green", "gray", "blue", "red"] as RowBgColor[]).map((c) => [c, c])
);
// 귀속 그룹(부모 프로젝트 id 기준) 표시용 — 프로젝트명 옆 동그라미 색. 같은 부모로 묶인 행끼리
// 같은 색, 서로 다른 그룹은 이 팔레트를 돌려가며 다른 색을 쓴다.
const MERGE_GROUP_PALETTE: RowBgColor[] = ["purple", "amber", "teal", "pink", "indigo", "cyan", "orange", "fuchsia"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; site_id?: string; status?: string; report?: string }>;
}) {
  const { tab, year, site_id, status, report } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">프로젝트·현장</h1>
      <div className="print:hidden">
        <PageTabs basePath="/projects" tabs={TABS} active={active} />
      </div>
      {active === "sites" && <SitesSection />}
      {active === "quotes" && <QuotesSection />}
      {active === "purchase_orders" && <PurchaseOrdersSection />}
      {active === "list" && <ProjectListSection year={year} siteId={site_id} status={status} report={report} />}
    </div>
  );
}

async function ProjectListSection({
  year,
  siteId,
  status,
  report,
}: {
  year?: string;
  siteId?: string;
  status?: string;
  report?: string;
}) {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;
  // 상태 필터는 체크박스로 여러 개를 동시에 고를 수 있어서 콤마로 구분된 값으로 옴.
  const statusList = status ? status.split(",").filter(Boolean) : [];

  let projectsQuery = supabase
    .from("projects")
    .select("*, sites(name)")
    .eq("year", selectedYear)
    .order("created_at", { ascending: false });
  if (siteId) projectsQuery = projectsQuery.eq("site_id", siteId);
  if (statusList.length > 0) projectsQuery = projectsQuery.in("status", statusList);

  const [{ data: sites }, { data: allProjects }, { data: projects }, { data: allYears }, { data: pageMemo }] =
    await Promise.all([
      supabase.from("sites").select("id, name, clients(name)").order("name"),
      supabase.from("projects").select("id, name, year, site_id"),
      projectsQuery,
      supabase.from("projects").select("year"),
      supabase.from("projects_page_memo").select("content").maybeSingle(),
    ]);

  const siteOptions = (sites ?? []).map((s) => {
    const clientName = (one(s.clients) as { name: string } | undefined)?.name;
    return { value: s.id, label: clientName ? `${clientName} · ${s.name}` : s.name };
  });
  const siteLabelMap = new Map(siteOptions.map((s) => [s.value, s.label]));

  const parentProjectOptions = (allProjects ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    year: p.year,
    siteLabel: siteLabelMap.get(p.site_id) ?? "미지정 현장",
  }));

  const projectIds = (projects ?? []).map((p) => p.id);
  const [{ data: purchaseRowsRaw }, { data: agencyRows }, { data: creditPayments }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, payment_type, sales_amount, sales_vat, project_id, purchase_amount, purchase_vat")
          .eq("type", "매입")
          .in("project_id", projectIds),
        supabase.from("project_agency_purchases").select("project_id, amount").in("project_id", projectIds),
        supabase.from("credit_payments").select("*"),
      ])
    : [
        {
          data: [] as {
            id: string;
            type: string;
            payment_type: string;
            sales_amount: number;
            sales_vat: number;
            project_id: string | null;
            purchase_amount: number;
            purchase_vat: number;
          }[],
        },
        { data: [] as { project_id: string; amount: number }[] },
        { data: [] as CreditPayment[] },
      ];

  // 외상(미완납)은 완납 전까지 장부에서 제외 — 대시보드·보고서와 동일한 기준.
  const purchaseRows = (purchaseRowsRaw ?? []).filter((t) => isLedgerVisible(t, (creditPayments ?? []) as CreditPayment[]));

  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseRows) {
    if (!t.project_id) continue;
    purchaseByProject.set(t.project_id, (purchaseByProject.get(t.project_id) ?? 0) + t.purchase_amount + t.purchase_vat);
  }

  const agencyByProject = new Map<string, number>();
  for (const a of agencyRows ?? []) {
    agencyByProject.set(a.project_id, (agencyByProject.get(a.project_id) ?? 0) + a.amount);
  }

  const fields: FieldConfig[] = [
    { name: "project_code", label: "프로젝트번호", readOnly: true, width: "7%" },
    {
      name: "site_id",
      label: "현장",
      type: "select",
      required: true,
      options: siteOptions,
      width: "10%",
    },
    {
      name: "name",
      label: "프로젝트명",
      required: true,
      width: "13%",
      tertiaryColorField: "contractMismatch",
      dotColorField: "mergeGroupColor",
    },
    {
      name: "parent_project_id",
      label: "귀속 프로젝트 (비용 합산 대상)",
      tableLabel: "귀속",
      type: "project-search",
      projectSearchOptions: parentProjectOptions,
      width: "5%",
      toggleable: true,
      defaultVisible: false,
    },
    {
      name: "status",
      label: "상태",
      type: "select",
      options: PROJECT_STATUS_OPTIONS,
      width: "6%",
    },
    {
      name: "rowColorKey",
      label: "행 색상",
      readOnly: true,
      hideInTable: true,
      rowBackgroundByValue: ROW_COLOR_IDENTITY_MAP,
    },
    {
      name: "is_service",
      label: "서비스(무상) 작업",
      tableLabel: "무상",
      type: "checkbox",
      width: "5%",
      toggleable: true,
      defaultVisible: false,
    },
    { name: "start_date", label: "시작일", type: "date", hideInTable: true },
    { name: "end_date", label: "완료일", type: "date", width: "7%", toggleable: true, defaultVisible: false },
    { name: "order_date", label: "발주서일자", type: "date", hideInTable: true },
    {
      name: "quote_amount",
      label: "발주액",
      type: "number",
      format: "currency",
      width: "8%",
      toggleable: true,
      defaultVisible: true,
    },
    {
      name: "contract_amount",
      label: "수주액",
      type: "number",
      format: "currency",
      width: "8%",
      toggleable: true,
      defaultVisible: false,
    },
    {
      name: "contract_amount_estimated",
      label: "수주액 예상금액 (체크 시 빨간색으로 표시)",
      type: "checkbox",
      hideInTable: true,
      exclusiveWith: "contract_amount_minimum",
    },
    {
      name: "contract_amount_minimum",
      label: "최소금액 산정액 (체크시 녹색으로 표시)",
      type: "checkbox",
      hideInTable: true,
      exclusiveWith: "contract_amount_estimated",
    },
    {
      name: "profit",
      label: "이익금",
      readOnly: true,
      format: "currency",
      width: "8%",
      colorField: "contract_amount_estimated",
      secondaryColorField: "contract_amount_minimum",
      toggleable: true,
      defaultVisible: false,
    },
    {
      name: "profitRate",
      label: "이익율",
      readOnly: true,
      width: "6%",
      colorField: "contract_amount_estimated",
      secondaryColorField: "contract_amount_minimum",
    },
    {
      name: "progress_pct",
      label: "진행률(%)",
      type: "number",
      display: "progress",
      width: "8%",
      toggleable: true,
      defaultVisible: true,
    },
    { name: "year", label: "연도", type: "number", required: true, hideInTable: true },
    { name: "memo", label: "메모", type: "textarea", width: "15%", toggleable: true, defaultVisible: false },
  ];

  const years = Array.from(
    new Set([...(allYears ?? []).map((p) => p.year), currentYear, selectedYear])
  ).sort((a, b) => b - a);

  const tableRows = (projects ?? []).map((p) => {
    const agencyAmount = agencyByProject.get(p.id) ?? 0;
    // 수주액이 발주액-대행구매액과 다르면(입력 실수 가능성) 프로젝트명을 노란색으로 표시.
    // 단, 결산 정리가 끝난 프로젝트는 목록에서 일반 검정으로 되돌림(보고서 팝업 안 경고는 별개, 항상 유지).
    const contractMismatch =
      !p.settlement_finalized &&
      (p.contract_amount ?? 0) > 0 && (p.quote_amount ?? 0) - (p.contract_amount ?? 0) - agencyAmount !== 0;
    const profit = p.quote_amount ? p.quote_amount - (purchaseByProject.get(p.id) ?? 0) - agencyAmount : null;
    // 이익율은 발주액 대비 비율 — 손익보고서 팝업/보고서 페이지와 동일한 계산 기준.
    const profitRate = p.quote_amount && profit !== null ? `${((profit / p.quote_amount) * 100).toFixed(1)}%` : "-";
    return {
      ...p,
      site_name: (one(p.sites) as { name: string } | undefined)?.name,
      profit,
      profitRate,
      contractMismatch,
    };
  });

  // 귀속 그룹(부모 프로젝트 id 기준) 동그라미 색 배정 — 처음 등장하는 순서대로 팔레트를 돌려 배정.
  const groupRootIds = Array.from(
    new Set(tableRows.filter((p) => p.parent_project_id).map((p) => p.parent_project_id as string))
  );
  const groupColorByRootId = new Map<string, RowBgColor>(
    groupRootIds.map((id, i) => [id, MERGE_GROUP_PALETTE[i % MERGE_GROUP_PALETTE.length]])
  );
  const statusByProjectId = new Map(tableRows.map((p) => [p.id, p.status as string | null]));

  const coloredRows = tableRows.map((p) => {
    const mergeGroupColor = p.parent_project_id
      ? groupColorByRootId.get(p.parent_project_id as string)
      : groupColorByRootId.get(p.id);
    // 귀속(merged) 상태는 자기 상태색이 없으니 귀속 대상 프로젝트의 상태색을 그대로 물려받는다.
    const effectiveStatus =
      p.status === "merged" && p.parent_project_id
        ? (statusByProjectId.get(p.parent_project_id as string) ?? p.status)
        : p.status;
    return { ...p, rowColorKey: statusRowColor(effectiveStatus), mergeGroupColor };
  });

  const awaitingPaymentProjects = tableRows.filter((p) => p.status === PROJECT_STATUS_AWAITING_PAYMENT);
  const awaitingPaymentContractSum = awaitingPaymentProjects.reduce((sum, p) => sum + (p.contract_amount ?? 0), 0);

  const filteredQuoteSum = tableRows.reduce((sum, p) => sum + (p.quote_amount ?? 0), 0);
  const filteredContractSum = tableRows.reduce((sum, p) => sum + (p.contract_amount ?? 0), 0);
  const filteredProfitSum = tableRows.reduce((sum, p) => sum + (p.profit ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className={report ? "space-y-6 print:hidden" : "space-y-6"}>
        {awaitingPaymentProjects.length > 0 && (
          <CollapsibleSection
            bare
            defaultOpen={false}
            title={<span className="text-red-600">공사완료 예상 미수액</span>}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 print:hidden"
          >
            <p className="text-xs text-red-600">완료 수금대기 {awaitingPaymentProjects.length}건의 수주액 합계</p>
            <p className="mt-1 font-mono text-xl font-bold text-red-600">{formatWon(awaitingPaymentContractSum)}</p>
          </CollapsibleSection>
        )}

        <ProjectsPageMemo initialContent={pageMemo?.content ?? ""} />

        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <YearFilter
            basePath="/projects"
            years={years}
            selectedYear={selectedYear}
            siteOptions={siteOptions}
            selectedSiteId={siteId}
            statusOptions={PROJECT_STATUS_OPTIONS}
            selectedStatuses={statusList}
          />
          <ProjectListExportButtons year={selectedYear} rows={tableRows} />
        </div>

        <div className="print:hidden">
          <CreatePanel title="프로젝트" fields={fields} createAction={createProjectRecord} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <EntityTable
            fields={fields}
            rows={coloredRows}
            groupByField="parent_project_id"
            updateAction={updateProjectRecord}
            deleteAction={deleteProjectRecord}
            editPopup
            extraActions={Object.fromEntries(
              (projects ?? []).map((p) => [
                p.id,
                <LinkButton
                  key={p.id}
                  href={`/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}&report=${p.id}`}
                  variant="secondary"
                  size="xs"
                >
                  보고서
                </LinkButton>,
              ])
            )}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span className="font-medium text-slate-500">필터된 {tableRows.length}건 합계</span>
            <span>
              발주액 <span className="font-mono font-semibold text-slate-900">{formatWon(filteredQuoteSum)}</span>
            </span>
            <span>
              수주액 <span className="font-mono font-semibold text-slate-900">{formatWon(filteredContractSum)}</span>
            </span>
            <span>
              이익금 <span className="font-mono font-semibold text-slate-900">{formatWon(filteredProfitSum)}</span>
            </span>
          </div>
        </div>
      </div>

      {report && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <ProjectProfitReport
              projectId={report}
              closeHref={`/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
