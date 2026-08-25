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
      <h1 className={`text-2xl font-bold text-slate-900 ${report ? "print:hidden" : ""}`}>프로젝트·현장</h1>
      <div className={report ? "print:hidden" : ""}>
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
    supabase.from("projects").select("id, name"),
    projectsQuery,
    supabase.from("projects").select("year"),
  ]);

  const siteOptions = (sites ?? []).map((s) => {
    const clientName = (one(s.clients) as { name: string } | undefined)?.name;
    return { value: s.id, label: clientName ? `${clientName} · ${s.name}` : s.name };
  });

  const fields: FieldConfig[] = [
    { name: "project_code", label: "프로젝트번호", readOnly: true },
    {
      name: "site_id",
      label: "현장",
      type: "select",
      required: true,
      options: siteOptions,
    },
    { name: "name", label: "프로젝트명", required: true },
    {
      name: "parent_project_id",
      label: "귀속 프로젝트 (비용 합산 대상)",
      type: "select",
      options: [{ value: "", label: "없음" }, ...(allProjects ?? []).map((p) => ({ value: p.id, label: p.name }))],
    },
    {
      name: "status",
      label: "상태",
      type: "select",
      options: [
        { value: "review", label: "검토중" },
        { value: "ongoing", label: "진행중" },
        { value: "done", label: "완료" },
        { value: "merged", label: "타 프로젝트 귀속" },
        { value: "etc", label: "기타" },
      ],
    },
    { name: "is_service", label: "서비스(무상) 작업", type: "checkbox" },
    { name: "start_date", label: "시작일", type: "date" },
    { name: "end_date", label: "완료일", type: "date" },
    { name: "order_date", label: "발주서일자", type: "date" },
    { name: "quote_amount", label: "발주액", type: "number" },
    { name: "contract_amount", label: "수주액", type: "number" },
    { name: "progress_pct", label: "진행률(%)", type: "number", display: "progress" },
    { name: "year", label: "연도", type: "number", required: true },
    { name: "memo", label: "메모", type: "textarea" },
  ];

  const years = Array.from(
    new Set([...(allYears ?? []).map((p) => p.year), currentYear, selectedYear])
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className={report ? "space-y-6 print:hidden" : "space-y-6"}>
        <div className="flex justify-end">
          <YearFilter
            basePath="/projects"
            years={years}
            selectedYear={selectedYear}
            siteOptions={siteOptions}
            selectedSiteId={siteId}
          />
        </div>

        <CreatePanel title="프로젝트" fields={fields} createAction={createProjectRecord} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <EntityTable
            fields={fields}
            rows={(projects ?? []).map((p) => ({ ...p, site_name: (one(p.sites) as { name: string } | undefined)?.name }))}
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
