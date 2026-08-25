import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createProjectRecord, updateProjectRecord, deleteProjectRecord } from "@/lib/actions/projects";
import type { FieldConfig } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { SitesSection } from "@/components/sections/SitesSection";
import { YearFilter } from "@/components/YearFilter";
import { ProjectProfitReport } from "@/components/ProjectProfitReport";
import { LinkButton } from "@/components/ui/Button";
import { PROJECT_STATUS_OPTIONS } from "@/lib/projectStatus";
import { formatWon } from "@/lib/format";
import { ProjectListExportButtons } from "@/components/ProjectListExportButtons";

const TABS = [
  { key: "list", label: "프로젝트" },
  { key: "sites", label: "현장" },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; site_id?: string; report?: string }>;
}) {
  const { tab, year, site_id, report } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 print:hidden">프로젝트·현장</h1>
      <div className="print:hidden">
        <PageTabs basePath="/projects" tabs={TABS} active={active} />
      </div>
      {active === "sites" && <SitesSection />}
      {active === "list" && <ProjectListSection year={year} siteId={site_id} report={report} />}
    </div>
  );
}

async function ProjectListSection({ year, siteId, report }: { year?: string; siteId?: string; report?: string }) {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;

  let projectsQuery = supabase
    .from("projects")
    .select("*, sites(name)")
    .eq("year", selectedYear)
    .order("created_at", { ascending: false });
  if (siteId) projectsQuery = projectsQuery.eq("site_id", siteId);

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
  const { data: purchaseRows } = projectIds.length
    ? await supabase
        .from("transactions")
        .select("project_id, purchase_amount, purchase_vat")
        .eq("type", "매입")
        .in("project_id", projectIds)
    : { data: [] as { project_id: string | null; purchase_amount: number; purchase_vat: number }[] };

  const purchaseByProject = new Map<string, number>();
  for (const t of purchaseRows ?? []) {
    if (!t.project_id) continue;
    purchaseByProject.set(t.project_id, (purchaseByProject.get(t.project_id) ?? 0) + t.purchase_amount + t.purchase_vat);
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
    { name: "name", label: "프로젝트명", required: true, width: "13%" },
    {
      name: "parent_project_id",
      label: "귀속 프로젝트 (비용 합산 대상)",
      tableLabel: "귀속",
      type: "project-search",
      projectSearchOptions: parentProjectOptions,
      width: "5%",
    },
    {
      name: "status",
      label: "상태",
      type: "select",
      options: PROJECT_STATUS_OPTIONS,
      width: "6%",
    },
    { name: "is_service", label: "서비스(무상) 작업", tableLabel: "무상", type: "checkbox", width: "5%" },
    { name: "start_date", label: "시작일", type: "date", hideInTable: true },
    { name: "end_date", label: "완료일", type: "date", width: "7%" },
    { name: "order_date", label: "발주서일자", type: "date", hideInTable: true },
    { name: "quote_amount", label: "발주액", type: "number", format: "currency", width: "8%" },
    { name: "contract_amount", label: "수주액", type: "number", format: "currency", hideInTable: true },
    {
      name: "contract_amount_estimated",
      label: "수주액 예상금액 (체크 시 빨간색으로 표시)",
      type: "checkbox",
      hideInTable: true,
    },
    {
      name: "profit",
      label: "이익금",
      readOnly: true,
      format: "currency",
      width: "8%",
      colorField: "contract_amount_estimated",
    },
    { name: "progress_pct", label: "진행률(%)", type: "number", display: "progress", width: "8%" },
    { name: "year", label: "연도", type: "number", required: true, hideInTable: true },
    { name: "memo", label: "메모", type: "textarea", width: "15%" },
  ];

  const years = Array.from(
    new Set([...(allYears ?? []).map((p) => p.year), currentYear, selectedYear])
  ).sort((a, b) => b - a);

  const tableRows = (projects ?? []).map((p) => ({
    ...p,
    site_name: (one(p.sites) as { name: string } | undefined)?.name,
    profit: p.contract_amount ? p.contract_amount - (purchaseByProject.get(p.id) ?? 0) : null,
  }));

  const estimatedProjects = tableRows.filter((p) => p.contract_amount_estimated);
  const estimatedProfitSum = estimatedProjects.reduce((sum, p) => sum + (p.profit ?? 0), 0);

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
            extraActions={Object.fromEntries(
              (projects ?? []).map((p) => [
                p.id,
                <LinkButton
                  key={p.id}
                  href={`/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}&report=${p.id}`}
                  variant="secondary"
                  size="xs"
                >
                  보고서
                </LinkButton>,
              ])
            )}
          />
        </div>
      </div>

      {report && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10 print:static print:bg-transparent print:p-0"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl print:max-w-none print:rounded-none print:shadow-none">
            <ProjectProfitReport
              projectId={report}
              closeHref={`/projects?tab=list&year=${selectedYear}${siteId ? `&site_id=${siteId}` : ""}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
