import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createProjectRecord, updateProjectRecord, deleteProjectRecord } from "@/lib/actions/projects";
import type { FieldConfig } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { SitesSection } from "@/components/sections/SitesSection";
import { QuotesSection } from "@/components/sections/QuotesSection";
import { PurchaseOrdersSection } from "@/components/sections/PurchaseOrdersSection";
import { YearFilter } from "@/components/YearFilter";
import { ProjectProfitReport } from "@/components/ProjectProfitReport";
import { LinkButton } from "@/components/ui/Button";
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_COLLECTED } from "@/lib/projectStatus";
import { formatWon } from "@/lib/format";
import { ProjectListExportButtons } from "@/components/ProjectListExportButtons";

const TABS = [
  { key: "list", label: "프로젝트" },
  { key: "sites", label: "현장" },
  { key: "quotes", label: "견적서" },
  { key: "purchase_orders", label: "발주서" },
];

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

  let projectsQuery = supabase
    .from("projects")
    .select("*, sites(name)")
    .eq("year", selectedYear)
    .order("created_at", { ascending: false });
  if (siteId) projectsQuery = projectsQuery.eq("site_id", siteId);
  if (status) projectsQuery = projectsQuery.eq("status", status);

  const [{ data: sites }, { data: allProjects }, { data: projects }, { data: allYears }] = await Promise.all([
    supabase.from("sites").select("id, name, clients(name)").order("name"),
    supabase.from("projects").select("id, name, year, site_id"),
    projectsQuery,
    supabase.from("projects").select("year"),
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
  const [{ data: purchaseRows }, { data: agencyRows }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("transactions")
          .select("project_id, purchase_amount, purchase_vat")
          .eq("type", "매입")
          .in("project_id", projectIds),
        supabase.from("project_agency_purchases").select("project_id, amount").in("project_id", projectIds),
      ])
    : [
        { data: [] as { project_id: string | null; purchase_amount: number; purchase_vat: number }[] },
        { data: [] as { project_id: string; amount: number }[] },
      ];

  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseRows ?? []) {
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
      rowBackgroundUnless: PROJECT_STATUS_COLLECTED,
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

  const estimatedProjects = tableRows.filter((p) => p.contract_amount_estimated);
  const estimatedProfitSum = estimatedProjects.reduce((sum, p) => sum + (p.profit ?? 0), 0);

  const filteredQuoteSum = tableRows.reduce((sum, p) => sum + (p.quote_amount ?? 0), 0);
  const filteredContractSum = tableRows.reduce((sum, p) => sum + (p.contract_amount ?? 0), 0);
  const filteredProfitSum = tableRows.reduce((sum, p) => sum + (p.profit ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className={report ? "space-y-6 print:hidden" : "space-y-6"}>
        {estimatedProjects.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 print:hidden">
            <p className="text-xs text-red-600">
              공사완료 예상 미수액 (수주액이 예상금액인 {estimatedProjects.length}건의 이익금 합계)
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-red-600">{formatWon(estimatedProfitSum)}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <YearFilter
            basePath="/projects"
            years={years}
            selectedYear={selectedYear}
            siteOptions={siteOptions}
            selectedSiteId={siteId}
            statusOptions={PROJECT_STATUS_OPTIONS}
            selectedStatus={status}
          />
          <ProjectListExportButtons year={selectedYear} rows={tableRows} />
        </div>

        <div className="print:hidden">
          <CreatePanel title="프로젝트" fields={fields} createAction={createProjectRecord} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
          <EntityTable
            fields={fields}
            rows={tableRows}
            updateAction={updateProjectRecord}
            deleteAction={deleteProjectRecord}
            editPopup
            extraActions={Object.fromEntries(
              (projects ?? []).map((p) => [
                p.id,
                <LinkButton
                  key={p.id}
                  href={`/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}${status ? `&status=${status}` : ""}&report=${p.id}`}
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
              closeHref={`/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}${status ? `&status=${status}` : ""}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
