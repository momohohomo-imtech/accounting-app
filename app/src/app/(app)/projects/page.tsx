import { createClient } from "@/lib/supabase/server";
import { CreatePanel } from "@/components/crud/CreatePanel";
import { EntityTable } from "@/components/crud/EntityTable";
import { createProjectRecord, updateProjectRecord, deleteProjectRecord } from "@/lib/actions/projects";
import type { FieldConfig } from "@/components/crud/types";
import { PageTabs } from "@/components/PageTabs";
import { SitesSection } from "@/components/sections/SitesSection";
import { YearFilter } from "@/components/YearFilter";

const TABS = [
  { key: "list", label: "프로젝트" },
  { key: "sites", label: "현장" },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string }>;
}) {
  const { tab, year } = await searchParams;
  const active = tab ?? "list";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">프로젝트·현장</h1>
      <PageTabs basePath="/projects" tabs={TABS} active={active} />
      {active === "sites" && <SitesSection />}
      {active === "list" && <ProjectListSection year={year} />}
    </div>
  );
}

async function ProjectListSection({ year }: { year?: string }) {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const selectedYear = year ? Number(year) : currentYear;

  const [{ data: sites }, { data: allProjects }, { data: projects }, { data: allYears }] = await Promise.all([
    supabase.from("sites").select("id, name, clients(name)").order("name"),
    supabase.from("projects").select("id, name"),
    supabase
      .from("projects")
      .select("*, sites(name)")
      .eq("year", selectedYear)
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("year"),
  ]);

  const siteOptions = (sites ?? []).map((s) => {
    const clientName = s.clients?.[0]?.name as string | undefined;
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
    { name: "progress_pct", label: "진행률(%)", type: "number" },
    { name: "year", label: "연도", type: "number", required: true },
  ];

  const years = Array.from(
    new Set([...(allYears ?? []).map((p) => p.year), currentYear, selectedYear])
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <YearFilter basePath="/projects" years={years} selectedYear={selectedYear} />
      </div>

      <CreatePanel title="프로젝트" fields={fields} createAction={createProjectRecord} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EntityTable
          fields={fields}
          rows={(projects ?? []).map((p) => ({ ...p, site_name: p.sites?.name }))}
          updateAction={updateProjectRecord}
          deleteAction={deleteProjectRecord}
        />
      </div>
    </div>
  );
}
